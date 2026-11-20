# Love, Me — Version 2 (React room foundation)

This is a clean React/Vite foundation for the room-based dress-up and beauty game.

## Run locally

```bash
cd v2
npm install
npm run dev
```

## Background asset

Place the approved room illustration at:

`v2/public/room-background.webp`

The room component loads it from `/room-background.webp`. The background is deliberately separate from interactive React elements so the room can later support clothing, makeup, accessories, and other stations.

## Current scope

- Full-viewport responsive room shell
- Station navigation for wardrobe, beauty vanity, and accessories
- Character-position marker for the room-navigation prototype
- Responsive desktop/mobile layout

The station panels are placeholders. The character marker is a navigation prototype, not the final animated character. Gameplay and character movement will be implemented in later stages.