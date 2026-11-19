import React, { useEffect, useState } from "react";
import { Composition, continueRender, delayRender, staticFile } from "remotion";
import { Board13, Hook13 } from "./Views";
import { Cover16, END_FRAMES, Reel16 } from "./Reel";
import { STILLS13 } from "./scenes";

// The site's own fonts (public/fonts/*.woff2, see README). A missing font does not stop the render: the browser falls
// back, and the checks then measure the fallback (so put the real fonts in before the final render).
const FONTS: [string, string, string][] = [
  ["Playfair Display", "fonts/playfair-cyrillic.woff2", "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"],
  ["Playfair Display", "fonts/playfair-latin.woff2", "U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC, U+2122, U+2212, U+FEFF"],
  ["Jost", "fonts/jost-cyrillic.woff2", "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"],
  ["Jost", "fonts/jost-latin.woff2", "U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC, U+2122, U+2212, U+FEFF"],
];
const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all(FONTS.map(([family, file, range]) => new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight: "100 900", unicodeRange: range }).load().then((f) => document.fonts.add(f)).catch(() => null)))
      .then(() => document.fonts.ready).then(() => continueRender(handle));
  }, [handle]);
  return <>{children}</>;
};
const W = 1080, H = 1920, FPS = 30;
const g = (el: React.ReactNode) => () => <FontGate>{el}</FontGate>;
export const Root: React.FC = () => (
  <>
    {/* the finished reel with music, the same without sound (rendered by beats), the caption masks for the checks */}
    <Composition id="Reel" component={g(<Reel16 />)} durationInFrames={END_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="ReelSilent" component={g(<Reel16 audio={false} />)} durationInFrames={END_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="ReelCaptions" component={g(<Reel16 mask />)} durationInFrames={END_FRAMES} fps={FPS} width={W} height={H} />
    {/* the storyboard: one still per frame (scenes.ts STILLS13), and its caption masks */}
    <Composition id="Board" component={g(<Board13 />)} durationInFrames={STILLS13.length} fps={FPS} width={W} height={H} />
    <Composition id="BoardCaptions" component={g(<Board13 mask />)} durationInFrames={STILLS13.length} fps={FPS} width={W} height={H} />
    {/* the hook's motion test (first 2.3 s) and the cover */}
    <Composition id="Hook" component={g(<Hook13 />)} durationInFrames={69} fps={FPS} width={W} height={H} />
    <Composition id="Cover" component={g(<Cover16 />)} durationInFrames={1} fps={FPS} width={W} height={H} />
    <Composition id="CoverMask" component={g(<Cover16 mask />)} durationInFrames={1} fps={FPS} width={W} height={H} />
  </>
);
