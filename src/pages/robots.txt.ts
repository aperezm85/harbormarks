export const GET = () => {
  return new Response("User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n", {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  })
}
