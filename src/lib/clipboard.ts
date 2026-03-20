/**
 * Copie du texte dans le presse-papier avec fallback pour HTTP (non-secure context).
 * navigator.clipboard.writeText() ne fonctionne qu'en HTTPS ou localhost.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Essayer l'API moderne
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback ci-dessous
    }
  }

  // 2. Fallback avec un textarea caché + execCommand
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
