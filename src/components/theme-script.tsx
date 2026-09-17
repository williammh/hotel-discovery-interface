/** Applies the stored theme before first paint so dark mode doesn't flash light. */
export function ThemeScript({ storageKey = "theme" }: { storageKey?: string }) {
  const script = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    storageKey
  )});var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.add(d?"dark":"light")}catch(e){}})();`

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
