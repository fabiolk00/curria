import { useEffect } from "react"
import { RouterProvider } from "react-router"
import { router } from "./routes"

const faviconSvg = `<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" rx="56" fill="#09090b"/>
  <path d="M80 72C80 63.1634 87.1634 56 96 56H144.343C148.587 56 152.657 57.6863 155.657 60.6863L171.314 76.3431C174.314 79.3431 176 83.4131 176 87.6569V184C176 192.837 168.837 200 160 200H96C87.1634 200 80 192.837 80 184V72Z" fill="url(#paint0_linear)"/>
  <path d="M104 104H152" stroke="#09090b" stroke-width="12" stroke-linecap="round"/>
  <path d="M104 136H152" stroke="#09090b" stroke-width="12" stroke-linecap="round"/>
  <path d="M104 168H132" stroke="#09090b" stroke-width="12" stroke-linecap="round"/>
  <circle cx="176" cy="184" r="28" fill="#18181b"/>
  <path d="M166 178L174 186L186 174" stroke="url(#paint0_linear)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <defs>
    <linearGradient id="paint0_linear" x1="128" y1="56" x2="128" y2="200" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ffffff"/>
      <stop offset="1" stop-color="#a1a1aa"/>
    </linearGradient>
  </defs>
</svg>`;

const faviconUrl = `data:image/svg+xml;base64,${btoa(faviconSvg)}`;

function App() {
  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
    document.title = "CurrIA";
  }, []);

  return <RouterProvider router={router} />
}

export default App