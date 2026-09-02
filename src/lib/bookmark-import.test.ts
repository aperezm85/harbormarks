import { describe, expect, it } from "vitest"

import {
   detectFormat,
   parseImportFile,
   parseTagList,
} from "./bookmark-import"

describe("parseTagList", () => {
   it("splits a comma-separated string and trims entries", () => {
     expect(parseTagList("dev, reading , rust")).toEqual([
        "dev",
        "reading",
        "rust",
      ])
   })

   it("accepts an actual array", () => {
     expect(parseTagList(["a", "b"])).toEqual(["a", "b"])
   })

   it("parses a JSON array string", () => {
     expect(parseTagList('["x", "y"]')).toEqual(["x", "y"])
   })

   it("drops whitespace-only entries", () => {
     expect(parseTagList("a, ,   ,b")).toEqual(["a", "b"])
   })

   it("falls back to comma parsing for a malformed JSON array", () => {
        // A value that parses as JSON is respected; one that does not is treated
        // as a plain comma-separated list.
      expect(parseTagList("[1,")).toEqual(["[1"])
        expect(parseTagList("alpha, beta")).toEqual(["alpha", "beta"])
        })

   it("returns an empty array for null or empty input", () => {
     expect(parseTagList(null)).toEqual([])
     expect(parseTagList("")).toEqual([])
     expect(parseTagList("   ")).toEqual([])
   })
})

describe("detectFormat", () => {
   it("prefers a declared format other than auto", () => {
     expect(
        detectFormat("anything", { declaredFormat: "csv" }).format
     ).toBe("csv")
   })

   it("rejects an unknown declared format", () => {
     expect(detectFormat("anything", { declaredFormat: "xml" }).format).toBeNull()
   })

   it("sniffs a Netscape HTML signature", () => {
     expect(
        detectFormat(
           "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DT><A HREF=\"http://x\"></A>"
        ).format
     ).toBe("html")
   })

   it("sniffs a JSON envelope", () => {
     expect(detectFormat('{"version":1,"bookmarks":[]}').format).toBe("json")
   })

   it("sniffs a CSV header starting with url,", () => {
     expect(detectFormat("url,title,description\nhttp://x").format).toBe("csv")
   })

   it("uses the filename when content is ambiguous", () => {
     expect(detectFormat("some text", { filename: "bookmarks.csv" }).format).toBe(
        "csv"
      )
     expect(detectFormat("some text", { filename: "export.html" }).format).toBe(
        "html"
     )
   })

   it("returns null when nothing matches", () => {
     expect(detectFormat("   ", { filename: "notes.txt" }).format).toBeNull()
   })
})

describe("parseImportFile — HarborMarks JSON", () => {
   it("round-trips the export envelope into rows", async () => {
     const content = JSON.stringify({
        version: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        bookmarks: [
          {
            url: "https://example.com/a",
            title: "A",
            description: "hello",
            favicon: "https://example.com/favicon.ico",
            previewImage: null,
            tags: ["dev", "reading"],
            isFavorite: true,
            visitCount: 12,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-02-01T00:00:00.000Z",
            lastVisitedAt: null,
            deletedAt: null,
          },
        ],
       })

     const result = parseImportFile(content, { filename: "harbormarks.json" })

     expect(result.ok).toBe(true)
     if (!result.ok) {
        return
       }

     expect(result.result.rows).toHaveLength(1)
     expect(result.result.rows[0].url).toBe("https://example.com/a")
     expect(result.result.rows[0].isFavorite).toBe(true)
     expect(result.result.rows[0].tags).toEqual(["dev", "reading"])
     expect(result.result.rows[0].favicon).toBe("https://example.com/favicon.ico")
     expect(result.result.rows[0].createdAt).toBe("2026-01-01T00:00:00.000Z")
    })

   it("rejects an unsupported version rather than guessing", () => {
     const content = JSON.stringify({
        version: 99,
        bookmarks: [],
       })

     const result = parseImportFile(content)
     expect(result.ok).toBe(false)
     if (result.ok) {
        return
       }

     expect(result.error).toContain("version")
     })

   it("rejects malformed JSON", () => {
     const result = parseImportFile("{ not json ", { declaredFormat: "json" })
     expect(result.ok).toBe(false)
     })
})

describe("parseImportFile — CSV", () => {
   it("parses a Pocket export, keeping archive status and bracketed tags", () => {
        // Pocket's tags cell is a JSON array; its members may be quoted
        // ("[\"news\", \"pocket\"]") or semicolon-joined ("[news;rust]").
      const content =
         "title,url,time_added,tags,status\n" +
         '"Pocket page","https://pocket.example.com/x",1451606400,"[news;rust]",archive\n'

      const result = parseImportFile(content, { filename: "pocket.csv" })

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
          }

      const row = result.result.rows[0]
      expect(row.url).toBe("https://pocket.example.com/x")
      expect(row.title).toBe("Pocket page")
      expect(row.tags).toEqual(["news", "rust"])
         // 1451606400 is a valid Unix timestamp; it must be preserved as createdAt.
      expect(row.createdAt).toBe(new Date(1451606400000).toISOString())
         })
    it("requires a url column and reports a missing url as null", () => {
     const content = "title,dummy\nNo url here,x\n"
     const result = parseImportFile(content, { filename: "generic.csv" })
     expect(result.ok).toBe(true)
     if (!result.ok) {
        return
       }

     expect(result.result.rows[0].url).toBeNull()
     })
})

describe("parseImportFile — Netscape HTML", () => {
   it("maps an anchor, its tags, a following DD, and a Unix ADD_DATE", () => {
     const content =
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n" +
        "<DL><p>\n" +
        '<DT><A HREF="https://example.gov/a" ADD_DATE="1767225600" ' +
        'TAGS="dev,reading">My Gov</A>\n' +
        "<DD>Hi &amp; bye\n" +
        "</DL><p>"

     const result = parseImportFile(content)
     expect(result.ok).toBe(true)
     if (!result.ok) {
        return
       }

     const row = result.result.rows[0]
     expect(row.url).toBe("https://example.gov/a")
     expect(row.title).toBe("My Gov")
     expect(row.tags).toEqual(["dev", "reading"])
     expect(row.description).toBe("Hi & bye")
     expect(row.createdAt).toBe(new Date(1767225600000).toISOString())
     })

   it("collects nested folder headings as tags and does not blow the stack", () => {
     let html = "<DL><p>"
     // Nest 300 folders deep; each heading becomes a tag.
     for (let i = 0; i < 300; i += 1) {
       html += `<H3>Folder${i}</H3><DL><p>`
       }

     html += '<DT><A HREF="https://deep.example.gov/x">Deep</A></DT>'

     for (let i = 0; i < 300; i += 1) {
        html += "</DL><p>"
        }

     html += "</DL><p>"

     const result = parseImportFile(html, { filename: "folders.html" })
     expect(result.ok).toBe(true)
     if (!result.ok) {
        return
       }

     expect(result.result.rows).toHaveLength(1)
     expect(result.result.rows[0].tags).toContain("Folder0")
     expect(result.result.rows[0].tags).toContain("Folder299")
     })

   it("decodes entities in a title and a quoted href", () => {
       // A well-formed Netscape entry whose title and href carry entities.
      const content =
         "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n" +
             '<DT><A HREF="https://x.gov/a?q=a&quot;b">A &amp; <b>quoted title</b></A>\n' +
          "</DL><p>"

      const result = parseImportFile(content)
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
         }

        // Entities are decoded to plain text by the parser.
      expect(result.result.rows[0].title).toContain("A & quoted")
       })
})

describe("parseImportFile — auto detection by content", () => {
   it("detects Netscape HTML and JSON from content alone", () => {
     expect(
        parseImportFile(
                 "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p><DT><A HREF=\"http://x\">X</A></DL><p>"
         ).ok
     ).toBe(true)
     expect(parseImportFile('{"version":1,"bookmarks":[]}').ok).toBe(true)
     })
})
