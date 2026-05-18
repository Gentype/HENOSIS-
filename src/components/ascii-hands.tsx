"use client";

/**
 * Pair of pure-CSS ASCII art hands that reach in from the bottom corners of
 * the hero. Zero network, zero canvas, zero JS animation loops — just a soft
 * up/down bob via CSS keyframes (see `.ascii-hand` in globals.css).
 *
 * Each hand is its own `<pre>` block so the monospace alignment survives
 * mobile font scaling. Colours are forced to matte sage-green; the glow is
 * baked into the CSS class.
 */

// Left hand, reaching up and slightly to the right. Built by hand to look
// like a stylised palm + four fingers + thumb without being too detailed.
const LEFT_HAND = `\
                ____
              .'    '.
             /        \\
            |  _    _  |
            | (_)  (_) |
       __   |          |   __
      /  \\__|          |__/  \\
     |                          |
     |    ____    ____    ____  |
     |   |    |  |    |  |    | |
     |   |    |  |    |  |    | |
      \\__|    |__|    |__|    |_/
         |    |  |    |  |    |
         |    |  |    |  |    |
         |    |  |    |  |    |
         |    |__|    |__|    |
         |              ___    |
         |             /   \\   |
         \\____________/     \\__/
         |                     |
         |                     |
         |                     |
         |                     |
        /                       \\
       /                         \\
      /                           \\
     /                             \\
    /                               \\
   /                                 \\
  /__________________________________ \\`;

// Right hand mirrors the left visually.
const RIGHT_HAND = `\
                  ____
                .'    '.
               /        \\
              |  _    _  |
              | (_)  (_) |
         __   |          |   __
        /  \\__|          |__/  \\
       |                          |
       |  ____    ____    ____    |
       | |    |  |    |  |    |   |
       | |    |  |    |  |    |   |
        \\|    |__|    |__|    |__/
         |    |  |    |  |    |
         |    |  |    |  |    |
         |    |  |    |  |    |
         |    |__|    |__|    |
         |    ___              |
         |   /   \\             |
         \\__/     \\____________/
         |                     |
         |                     |
         |                     |
         |                     |
        /                       \\
       /                         \\
      /                           \\
     /                             \\
    /                               \\
   /                                 \\
  /__________________________________ \\`;

export function AsciiHands() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <pre className="ascii-hand ascii-hand--left">{LEFT_HAND}</pre>
      <pre className="ascii-hand ascii-hand--right">{RIGHT_HAND}</pre>
    </div>
  );
}
