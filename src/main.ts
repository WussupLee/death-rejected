import "./styles.css";
import { Game } from "./game/Game";
import { AssetLibrary } from "./game/AssetLibrary";
const button = document.getElementById("begin-button") as HTMLButtonElement;
button.disabled = true;
const assets = new AssetLibrary();
assets
  .load()
  .then(() => {
    new Game(assets);
    button.disabled = false;
    button.focus();
  })
  .catch((error) => {
    button.textContent = "RELOAD TO RETRY";
    button.disabled = false;
    button.addEventListener("click", () => location.reload());
    const detail = document.querySelector(".menu-tagline");
    if (detail) detail.textContent = String(error);
  });
