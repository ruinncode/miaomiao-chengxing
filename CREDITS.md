# CREDITS

## Toronto streets: OpenStreetMap data

Street layouts in Toronto's 实景像素 (real-pixel) mode come from **© OpenStreetMap contributors**, licensed under the [Open Database License (ODbL)](https://www.openstreetmap.org/copyright). That covers street direction and length, the order, width and storeys of buildings, shop and place names, TTC stops and subway entrances, Bike Share docks, artworks and cross streets. The data was fetched once through the Overpass API on 2026-10-27, and `tools/build_streets.py` turned it into `js/cities/toronto-streets.js` (a Produced Work, with the data shared under ODbL). Any value that is a guess, such as an untagged colour, assumed storeys, a hand-traced street axis or a renamed building, is marked `approximate` in that file. Shops are drawn as plain storefronts with their names in text; no logos are used. Hotel rooms, the interview company and any 短租公寓 interiors are fictional and set inside real buildings.

## Real-pixel Toronto views（实景像素）

On by default for Toronto. The 「实景像素 / 手绘像素」 button on a street, or the window setting in a hotel room, switches between them, and the choice is saved in `localStorage.mm_real`. The drawn pixel view is shown while the images load (lazy-loaded) and whenever 手绘像素 is chosen.

All photos come from **Wikimedia Commons** under the licences shown, checked against the Commons API `extmetadata` on 2026-10-27. `tools/pixelate_photos.py` changes them in these ways: crop (the Distillery crop also removes the only visitors in any photo), downscale to 320×180, colour-grade into day / dusk / night variants (night adds generated window lights and stars), darken edges, Bayer-dither onto a 28-colour palette, and split into sky and city parallax layers. The output is PNG-8 in `assets/photos/toronto/px/` (about 300 KB for all 30 files). The downscaled sources are kept in `tools/photo_src/`, which is not deployed. Derivatives of CC BY-SA photos are shared under the same licence, and the CC BY 2.0 photo's derivative under CC BY 2.0. The in-game 致谢 · Credits screen on the title page lists the same attributions.

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
- Real-world place names, lines and stations are used for flavour. In Toronto the shops are the real ones from OSM (see above); in the other cities the shops, cafés and hotels are fictional.

## Storefronts (Toronto)
- Every storefront look (js/cities/toronto-shops.js, drawn by js/hub/storefront.js) is hand-drawn pixel art. It is **approximate**: it is based on OSM tags (shop kind, brand), general brand colours and public Wikimedia Commons photos of the streets (for example Category:Distillery District and Mill Street). No logos or brand artwork are copied; signs are plain-text wordmarks.
- Westin Harbour Castle podium/tower and Union Station colonnade: approximate, drawn from public photos and the heritage descriptions.
- Eglinton Line 5 entrance pavilion: approximate, drawn after public Metrolinx/Crosstown renderings and photos.
- Shop positions follow OSM (© OpenStreetMap contributors, ODbL); some are nudged along the street so the signs fit, so they are approximate.
