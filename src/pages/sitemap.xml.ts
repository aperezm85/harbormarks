export const GET = ({ site }: { site?: URL }) => {
  const origin = site?.origin ?? "https://example.com"

  const urls = [
    "/",
    "/favorites",
    "/profile",
    "/login",
    "/register",
    "/forgot-password",
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n")}
</urlset>`

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
  })
}
