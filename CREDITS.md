# CREDITS

## Real-photo Toronto mode（实景照片模式）

Opt-in per device: the 「像素 / 实景 ✓」 button on any Toronto street, or 「窗外风景设置 → 窗外：实景照片」 in a Toronto hotel room (saved in `localStorage.mm_real`). Off by default; the pixel-art views are always the fallback while a photo is loading.

All photos come from **Wikimedia Commons** under the licence shown (checked against the Commons API `extmetadata` on 2026-10-27). Changes: downscaled to 1600 px wide and re-encoded as WebP (`assets/photos/toronto/*.webp`, 145–460 KB each); in-game they are cropped/panned to fit the view and tinted for time of day/weather. Derivatives of CC BY-SA photos are shared under the same licence.

| File | Used for | Author | Licence | Source |
|---|---|---|---|---|
| `to-lake.webp` | 湖滨窗景 / 湖滨街景天空 / CN 塔合影、溜冰 | Maksim Sokolov (maxergon.com) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Toronto skyline viewed from Trillium Park.jpg](https://commons.wikimedia.org/wiki/File:Toronto_skyline_viewed_from_Trillium_Park.jpg) |
| `to-island.webp` | 渡轮去多伦多群岛（划船背景） | Jchmrt | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Sunset Toronto Skyline Panorama Crop from Snake Island.jpg](https://commons.wikimedia.org/wiki/File:Sunset_Toronto_Skyline_Panorama_Crop_from_Snake_Island.jpg) |
| `to-dt.webp` | 金融区 Bay St 窗景与面试/PATH 背景 | Alessio Bragadini from Milan, Italy | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | [Toronto financial district view.jpg](https://commons.wikimedia.org/wiki/File:Toronto_financial_district_view.jpg) |
| `to-dist.webp` | 酿酒厂区 Loft 窗景、冬季市集、红砖巷拍照 | Mark | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Distillery District - Toronto (40194261852).jpg](https://commons.wikimedia.org/wiki/File:Distillery_District_-_Toronto_(40194261852).jpg) |
| `to-mid.webp` | Yonge & Eglinton 公寓窗景、brunch | Maksim Sokolov (Maxergon) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Yonge-Eglinton, Toronto.jpg](https://commons.wikimedia.org/wiki/File:Yonge-Eglinton,_Toronto.jpg) |

Not used, by design: Google Street View / Google Maps imagery (no scraping; a Maps Embed is only described in docs/TRAVEL_NOTES.md, not implemented), copyrighted photos, or AI-generated images of real places.

## Everything else

- Pixel art, cats, cities, rooms and UI: drawn in code for this project.
- Font: Zpix (最像素) by SolidZORO, https://github.com/SolidZORO/zpix-pixel-font — check its licence terms before any commercial use.
- Music: original lo-fi patterns generated in `js/audio.js` (no copyrighted music). "自己的音乐" plays a file you pick locally via `Sfx.useFile`; nothing is uploaded. (There is no MIDI import.)
- Libraries: Phaser 3 (MIT), PeerJS (MIT).
- Real-world place names, lines and stations are used for flavour; shops, cafés and hotels are fictional.
