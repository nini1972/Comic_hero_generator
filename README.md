<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/14wkWFX1GPNQkL4aCPAZAK6E-1JXPqynh

## Living Comic (code-generated scenes)

Branch `feat/living-scenes` adds an image-free mode: each panel is a small `SceneSpec` (location, time of day, weather, mood, tension, damage, cast, props, effects) rendered as an animated SVG scene.

- Run `npm run dev` and open `/living.html`.
- `living/director.ts` turns a story beat plus the evolving world (`living/world.ts`) into the next scene. It is instant and offline; an optional Gemini-written beat can include a `sceneHint` that is validated before use.
- Scenes stay continuous: the same place keeps its skyline, time of day flows forward, damage accumulates, fires burn out, and actors walk on and off stage.
- Without an API key the built-in branching story is used. With `GEMINI_API_KEY` set, tick "Gemini writer"; any failure falls back to the offline story.
- The "Scene lab" sliders edit the live scene so you can watch the renderer adapt.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
