import { useId } from 'react'
import { cx, hashUnit } from '@/utils/format'

/**
 * Generated product photography stand-in.
 *
 * Every product renders a studio-style SVG scene derived from `art.shape` and
 * `art.hue`, so the storefront never shows a broken image and every tile is
 * colour-coordinated with its category. Drop a real photo in via the product's
 * `image` key and this component steps aside.
 */

const palette = (h) => ({
  bg1: `hsl(${h} 42% 95%)`,
  bg2: `hsl(${(h + 24) % 360} 32% 87%)`,
  bg3: `hsl(${(h + 340) % 360} 45% 92%)`,
  body: `hsl(${h} 30% 46%)`,
  bodyDeep: `hsl(${h} 34% 32%)`,
  bodyLight: `hsl(${h} 34% 62%)`,
  cap: `hsl(${(h + 18) % 360} 22% 21%)`,
  gold: '#b78b4f',
  label: '#fbf7f2',
  ink: '#241a20',
})

/* ------------------------------ shape library ----------------------------- */

const SHAPES = {
  /* Folded hijab — stacked fabric bands with a soft drape edge */
  hijab: (c, gid) => (
    <g>
      <path d={`M104 322 Q200 292 296 322 L296 372 Q200 400 104 372 Z`} fill={c.bodyDeep} />
      <path d={`M104 282 Q200 252 296 282 L296 332 Q200 360 104 332 Z`} fill={c.body} />
      <path d={`M104 242 Q200 212 296 242 L296 292 Q200 320 104 292 Z`} fill={c.bodyLight} />
      <path
        d={`M112 246 Q200 220 288 246`}
        fill="none"
        stroke={c.label}
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      {/* draped tail falling from the stack */}
      <path
        d={`M296 250 Q334 288 320 342 Q312 372 288 386 Q302 340 288 300 Q282 274 296 250 Z`}
        fill={c.body}
        opacity="0.92"
      />
      <path
        d={`M104 250 Q66 288 80 342 Q88 372 112 386 Q98 340 112 300 Q118 274 104 250 Z`}
        fill={c.bodyDeep}
        opacity="0.8"
      />
      {/* paper belly band */}
      <rect x="164" y="262" width="72" height="34" rx="4" fill={c.label} opacity="0.94" />
      <text
        x="200"
        y="284"
        textAnchor="middle"
        fontSize="12"
        letterSpacing="2.4"
        fill={c.ink}
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="600"
      >
        GBS
      </text>
      <ellipse cx="200" cy="404" rx="118" ry="14" fill={c.ink} opacity="0.07" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Serum bottle with pipette */
  dropper: (c, gid) => (
    <g>
      <rect x="176" y="96" width="48" height="26" rx="5" fill={c.cap} />
      <rect x="184" y="118" width="32" height="14" rx="3" fill={c.gold} />
      <path d="M164 132h72a10 10 0 0 1 10 10v168a16 16 0 0 1-16 16h-60a16 16 0 0 1-16-16V142a10 10 0 0 1 10-10z" fill={c.body} />
      <path d="M164 132h26v194h-10a16 16 0 0 1-16-16V142a10 10 0 0 1 10-10z" fill={c.bodyLight} opacity="0.45" />
      <rect x="176" y="182" width="48" height="98" rx="4" fill={c.label} opacity="0.95" />
      <rect x="184" y="196" width="32" height="2" fill={c.ink} opacity="0.5" />
      <rect x="184" y="206" width="22" height="2" fill={c.ink} opacity="0.3" />
      <rect x="184" y="252" width="32" height="14" rx="2" fill={c.gold} opacity="0.35" />
      <ellipse cx="200" cy="342" rx="72" ry="12" fill={c.ink} opacity="0.09" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Toner / classic bottle */
  bottle: (c, gid) => (
    <g>
      <rect x="182" y="88" width="36" height="34" rx="4" fill={c.cap} />
      <path d="M188 122h24l6 24h-36z" fill={c.bodyDeep} />
      <path d="M160 146h80a8 8 0 0 1 8 8v152a18 18 0 0 1-18 18h-60a18 18 0 0 1-18-18V154a8 8 0 0 1 8-8z" fill={c.body} />
      <path d="M160 146h24v178h-6a18 18 0 0 1-18-18V154a8 8 0 0 1 8-8z" fill={c.bodyLight} opacity="0.5" />
      <rect x="172" y="192" width="56" height="86" rx="3" fill={c.label} opacity="0.95" />
      <circle cx="200" cy="220" r="13" fill="none" stroke={c.gold} strokeWidth="1.4" />
      <path d="M194 220h12M200 214v12" stroke={c.gold} strokeWidth="1.2" />
      <rect x="182" y="246" width="36" height="2" fill={c.ink} opacity="0.4" />
      <rect x="188" y="256" width="24" height="2" fill={c.ink} opacity="0.25" />
      <ellipse cx="200" cy="340" rx="76" ry="12" fill={c.ink} opacity="0.09" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Pump bottle — cleanser, shampoo, foundation */
  pump: (c, gid) => (
    <g>
      <path d="M198 66h6v14h20a8 8 0 0 1 0 16h-8v18h-24V96h-2a8 8 0 0 1 0-16h8z" fill={c.cap} />
      <rect x="180" y="112" width="40" height="16" rx="4" fill={c.gold} opacity="0.85" />
      <path d="M156 128h88a10 10 0 0 1 10 10v160a20 20 0 0 1-20 20h-68a20 20 0 0 1-20-20V138a10 10 0 0 1 10-10z" fill={c.body} />
      <path d="M156 128h26v190h-6a20 20 0 0 1-20-20V138a10 10 0 0 1 10-10z" fill={c.bodyLight} opacity="0.45" />
      <rect x="168" y="176" width="64" height="96" rx="4" fill={c.label} opacity="0.95" />
      <rect x="180" y="194" width="40" height="3" fill={c.ink} opacity="0.55" />
      <rect x="186" y="206" width="28" height="2" fill={c.ink} opacity="0.3" />
      <path d="M184 240h32" stroke={c.gold} strokeWidth="1.4" />
      <rect x="186" y="248" width="28" height="2" fill={c.ink} opacity="0.22" />
      <ellipse cx="200" cy="332" rx="82" ry="13" fill={c.ink} opacity="0.09" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Squeeze tube — sunscreen, lotion */
  tube: (c, gid) => (
    <g>
      <rect x="182" y="92" width="36" height="22" rx="6" fill={c.cap} />
      <path d="M170 114h60v18h-60z" fill={c.bodyDeep} />
      <path d="M170 132h60v152l-8 34h-44l-8-34z" fill={c.body} />
      <path d="M170 132h18v186h-10l-8-34z" fill={c.bodyLight} opacity="0.5" />
      <path d="M178 318h44l-3 12h-38z" fill={c.cap} />
      <rect x="180" y="168" width="40" height="112" rx="3" fill={c.label} opacity="0.94" />
      <text
        x="200"
        y="202"
        textAnchor="middle"
        fontSize="19"
        fill={c.ink}
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="700"
      >
        50
      </text>
      <text
        x="200"
        y="218"
        textAnchor="middle"
        fontSize="9"
        letterSpacing="1.6"
        fill={c.ink}
        opacity="0.6"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        SPF
      </text>
      <rect x="186" y="238" width="28" height="2" fill={c.ink} opacity="0.3" />
      <rect x="190" y="248" width="20" height="2" fill={c.ink} opacity="0.2" />
      <ellipse cx="200" cy="340" rx="66" ry="11" fill={c.ink} opacity="0.09" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Cream jar */
  jar: (c, gid) => (
    <g>
      <ellipse cx="200" cy="176" rx="76" ry="18" fill={c.cap} />
      <path d="M124 176h152v34a12 12 0 0 1-12 12H136a12 12 0 0 1-12-12z" fill={c.cap} />
      <ellipse cx="200" cy="176" rx="60" ry="13" fill={c.gold} opacity="0.28" />
      <path d="M130 222h140v66a26 26 0 0 1-26 26H156a26 26 0 0 1-26-26z" fill={c.body} />
      <path d="M130 222h26v92h-0a26 26 0 0 1-26-26z" fill={c.bodyLight} opacity="0.45" />
      <rect x="156" y="248" width="88" height="42" rx="3" fill={c.label} opacity="0.92" />
      <text
        x="200"
        y="268"
        textAnchor="middle"
        fontSize="11"
        letterSpacing="3"
        fill={c.ink}
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="600"
      >
        GBS
      </text>
      <path d="M176 278h48" stroke={c.gold} strokeWidth="1.2" />
      <ellipse cx="200" cy="330" rx="86" ry="13" fill={c.ink} opacity="0.1" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Shallow tin — balm, pins */
  tin: (c, gid) => (
    <g>
      <ellipse cx="200" cy="264" rx="88" ry="30" fill={c.bodyDeep} />
      <path d="M112 264h176v26a20 20 0 0 1-20 20H132a20 20 0 0 1-20-20z" fill={c.bodyDeep} />
      <ellipse cx="200" cy="252" rx="88" ry="30" fill={c.body} />
      <ellipse cx="200" cy="252" rx="70" ry="23" fill="none" stroke={c.gold} strokeWidth="1.4" opacity="0.75" />
      <ellipse cx="200" cy="248" rx="52" ry="16" fill={c.label} opacity="0.16" />
      <text
        x="200"
        y="250"
        textAnchor="middle"
        fontSize="13"
        letterSpacing="4"
        fill={c.label}
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="600"
      >
        GBS
      </text>
      <text
        x="200"
        y="266"
        textAnchor="middle"
        fontSize="7.5"
        letterSpacing="2.4"
        fill={c.label}
        opacity="0.7"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        DHAKA
      </text>
      <ellipse cx="200" cy="322" rx="96" ry="13" fill={c.ink} opacity="0.09" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Lipstick bullet, cap off */
  lipstick: (c, gid) => (
    <g>
      {/* cap resting beside */}
      <rect x="268" y="238" width="34" height="86" rx="8" fill={c.cap} />
      <rect x="268" y="238" width="11" height="86" rx="6" fill={c.label} opacity="0.14" />
      {/* body */}
      <rect x="164" y="212" width="56" height="112" rx="7" fill={c.cap} />
      <rect x="164" y="212" width="17" height="112" rx="6" fill={c.label} opacity="0.13" />
      <rect x="164" y="230" width="56" height="9" fill={c.gold} />
      <rect x="170" y="196" width="44" height="18" fill={c.gold} opacity="0.9" />
      {/* bullet */}
      <path d="M176 196v-40a8 8 0 0 1 4-7l24-14a6 6 0 0 1 9 5v56z" fill={c.body} />
      <path d="M176 196v-40a8 8 0 0 1 4-7l8-4v51z" fill={c.bodyLight} opacity="0.55" />
      <ellipse cx="216" cy="336" rx="102" ry="13" fill={c.ink} opacity="0.1" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Twist-up kajal / liner pencil */
  pencil: (c, gid) => (
    <g>
      <rect x="182" y="120" width="36" height="26" rx="7" fill={c.gold} />
      <rect x="176" y="146" width="48" height="150" rx="10" fill={c.cap} />
      <rect x="176" y="146" width="15" height="150" rx="8" fill={c.label} opacity="0.12" />
      <rect x="176" y="176" width="48" height="6" fill={c.gold} opacity="0.8" />
      <text
        x="200"
        y="238"
        textAnchor="middle"
        fontSize="10"
        letterSpacing="3"
        fill={c.label}
        opacity="0.85"
        fontFamily="Plus Jakarta Sans, sans-serif"
        transform="rotate(90 200 238)"
      >
        KAJAL
      </text>
      <path d="M184 296h32l-16 34z" fill={c.body} />
      <path d="M192 314h16l-8 16z" fill={c.ink} />
      <ellipse cx="200" cy="344" rx="60" ry="10" fill={c.ink} opacity="0.09" filter={`url(#blur-${gid})`} />
    </g>
  ),

  mascara: (c, gid) => (
    <g>
      <rect x="184" y="86" width="32" height="60" rx="8" fill={c.cap} />
      <rect x="184" y="86" width="10" height="60" rx="6" fill={c.label} opacity="0.12" />
      <rect x="192" y="146" width="16" height="20" fill={c.gold} opacity="0.7" />
      <path d="M174 166h52a10 10 0 0 1 10 10v128a18 18 0 0 1-18 18h-36a18 18 0 0 1-18-18V176a10 10 0 0 1 10-10z" fill={c.body} />
      <path d="M174 166h16v156h-6a18 18 0 0 1-18-18V176a10 10 0 0 1 10-10z" fill={c.bodyLight} opacity="0.45" />
      <text
        x="200"
        y="252"
        textAnchor="middle"
        fontSize="10"
        letterSpacing="3"
        fill={c.label}
        fontFamily="Plus Jakarta Sans, sans-serif"
        transform="rotate(90 200 252)"
      >
        VOLUME
      </text>
      <ellipse cx="200" cy="336" rx="62" ry="11" fill={c.ink} opacity="0.09" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Open compact — powder / blush duo */
  compact: (c, gid) => (
    <g>
      {/* open lid, tilted back */}
      <rect x="96" y="130" width="150" height="112" rx="14" fill={c.cap} transform="rotate(-8 171 186)" />
      <rect x="110" y="144" width="122" height="84" rx="8" fill="#c9cdd4" transform="rotate(-8 171 186)" opacity="0.9" />
      <rect x="110" y="144" width="122" height="84" rx="8" fill={c.label} transform="rotate(-8 171 186)" opacity="0.25" />
      {/* base */}
      <rect x="132" y="238" width="164" height="76" rx="16" fill={c.cap} />
      <rect x="132" y="238" width="164" height="14" rx="7" fill={c.label} opacity="0.1" />
      <circle cx="186" cy="278" r="30" fill={c.body} />
      <circle cx="186" cy="278" r="30" fill="none" stroke={c.gold} strokeWidth="1.2" opacity="0.8" />
      <circle cx="252" cy="278" r="30" fill={c.bodyLight} />
      <circle cx="252" cy="278" r="30" fill="none" stroke={c.gold} strokeWidth="1.2" opacity="0.8" />
      <ellipse cx="212" cy="326" rx="104" ry="13" fill={c.ink} opacity="0.1" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Fanned brush set */
  brush: (c, gid) => (
    <g>
      {[-26, -13, 0, 13, 26].map((angle, i) => (
        <g key={angle} transform={`rotate(${angle} 200 330)`}>
          <rect x="194" y="150" width="12" height="180" rx="6" fill={i % 2 ? c.cap : c.bodyDeep} />
          <rect x="192" y="140" width="16" height="26" rx="3" fill={c.gold} />
          <path
            d="M192 140c0-22 2-42 8-52 6 10 8 30 8 52z"
            fill={i % 2 ? c.bodyLight : c.body}
          />
        </g>
      ))}
      <ellipse cx="200" cy="344" rx="86" ry="12" fill={c.ink} opacity="0.1" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Ribboned gift box */
  giftbox: (c, gid) => (
    <g>
      <path d="M112 200h176v122a14 14 0 0 1-14 14H126a14 14 0 0 1-14-14z" fill={c.body} />
      <path d="M112 200h34v136h-20a14 14 0 0 1-14-14z" fill={c.bodyLight} opacity="0.4" />
      <rect x="102" y="168" width="196" height="42" rx="8" fill={c.bodyDeep} />
      <rect x="102" y="168" width="196" height="12" rx="6" fill={c.label} opacity="0.12" />
      <rect x="184" y="168" width="32" height="168" fill={c.gold} opacity="0.92" />
      <path
        d="M200 168c-18-6-34-16-34-30a16 16 0 0 1 30-6 16 16 0 0 1 30 6c0 14-16 24-34 30z"
        fill={c.gold}
      />
      <circle cx="200" cy="134" r="7" fill={c.bodyDeep} opacity="0.85" />
      <ellipse cx="200" cy="348" rx="106" ry="13" fill={c.ink} opacity="0.1" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Zip pouch / organiser */
  pouch: (c, gid) => (
    <g>
      <path d="M118 186h164a12 12 0 0 1 12 12v112a18 18 0 0 1-18 18H124a18 18 0 0 1-18-18V198a12 12 0 0 1 12-12z" fill={c.body} />
      <path d="M118 186h30v142h-24a18 18 0 0 1-18-18V198a12 12 0 0 1 12-12z" fill={c.bodyLight} opacity="0.4" />
      <rect x="106" y="188" width="188" height="16" rx="8" fill={c.cap} />
      <circle cx="270" cy="196" r="8" fill={c.gold} />
      <rect x="266" y="200" width="8" height="26" rx="4" fill={c.gold} />
      <rect x="150" y="238" width="100" height="52" rx="4" fill={c.label} opacity="0.9" />
      <text
        x="200"
        y="262"
        textAnchor="middle"
        fontSize="12"
        letterSpacing="3"
        fill={c.ink}
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="600"
      >
        GBS
      </text>
      <path d="M172 274h56" stroke={c.gold} strokeWidth="1.2" />
      <ellipse cx="200" cy="342" rx="104" ry="13" fill={c.ink} opacity="0.1" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Attar roll-on */
  attar: (c, gid) => (
    <g>
      <path d="M186 84h28v16h-28z" fill={c.gold} />
      <path d="M178 100h44l-6 22h-32z" fill={c.cap} />
      <path d="M172 122h56a12 12 0 0 1 12 12l10 84a34 34 0 0 1-34 40h-32a34 34 0 0 1-34-40l10-84a12 12 0 0 1 12-12z" fill={c.body} />
      <path d="M172 122h20l-14 136h-2a34 34 0 0 1-24-40z" fill={c.bodyLight} opacity="0.42" />
      <ellipse cx="200" cy="212" rx="34" ry="30" fill={c.label} opacity="0.9" />
      <text
        x="200"
        y="208"
        textAnchor="middle"
        fontSize="11"
        letterSpacing="2"
        fill={c.ink}
        fontFamily="Fraunces, serif"
      >
        OUD
      </text>
      <text
        x="200"
        y="224"
        textAnchor="middle"
        fontSize="8"
        letterSpacing="2"
        fill={c.ink}
        opacity="0.6"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        &amp; ROSE
      </text>
      <ellipse cx="200" cy="272" rx="58" ry="11" fill={c.ink} opacity="0.1" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Rolled prayer mat */
  mat: (c, gid) => (
    <g>
      <path d="M96 236h208v70a16 16 0 0 1-16 16H112a16 16 0 0 1-16-16z" fill={c.bodyDeep} />
      <ellipse cx="96" cy="271" rx="26" ry="35" fill={c.body} />
      <ellipse cx="96" cy="271" rx="15" ry="21" fill={c.bodyLight} opacity="0.6" />
      <ellipse cx="96" cy="271" rx="6" ry="9" fill={c.bodyDeep} />
      <ellipse cx="304" cy="271" rx="26" ry="35" fill={c.body} />
      <ellipse cx="304" cy="271" rx="15" ry="21" fill={c.bodyLight} opacity="0.55" />
      <path d="M200 218v-38" stroke={c.gold} strokeWidth="2" />
      <path
        d="M200 152c14 0 24 10 24 22 0 8-4 14-10 18h-28c-6-4-10-10-10-18 0-12 10-22 24-22z"
        fill={c.body}
      />
      <path d="M200 168v24M188 180h24" stroke={c.label} strokeWidth="1.6" opacity="0.7" />
      <rect x="150" y="248" width="100" height="46" rx="4" fill={c.label} opacity="0.14" />
      <ellipse cx="200" cy="330" rx="118" ry="13" fill={c.ink} opacity="0.1" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Quilted crossbody */
  bag: (c, gid) => (
    <g>
      <path
        d="M148 116a52 52 0 0 1 104 0"
        fill="none"
        stroke={c.gold}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M124 176h152a14 14 0 0 1 14 14v106a20 20 0 0 1-20 20H130a20 20 0 0 1-20-20V190a14 14 0 0 1 14-14z" fill={c.body} />
      <path d="M124 176h28v140h-22a20 20 0 0 1-20-20V190a14 14 0 0 1 14-14z" fill={c.bodyLight} opacity="0.4" />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3, 4].map((col) => (
          <rect
            key={`${r}-${col}`}
            x={128 + col * 30}
            y={190 + r * 30}
            width="30"
            height="30"
            fill="none"
            stroke={c.label}
            strokeOpacity="0.22"
            strokeWidth="1"
            transform={`rotate(45 ${128 + col * 30 + 15} ${190 + r * 30 + 15})`}
          />
        )),
      )}
      <rect x="176" y="164" width="48" height="26" rx="6" fill={c.gold} />
      <circle cx="200" cy="177" r="6" fill={c.bodyDeep} />
      <ellipse cx="200" cy="330" rx="104" ry="13" fill={c.ink} opacity="0.1" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Pearl drop earrings */
  jewel: (c, gid) => (
    <g>
      {[-52, 52].map((dx) => (
        <g key={dx} transform={`translate(${dx} 0)`}>
          <path
            d="M200 152a20 20 0 1 1 0 40"
            fill="none"
            stroke={c.gold}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="200" cy="200" r="6" fill={c.gold} />
          <ellipse cx="200" cy="236" rx="26" ry="32" fill="#f3e9df" />
          <ellipse cx="192" cy="226" rx="9" ry="12" fill="#ffffff" opacity="0.85" />
          <ellipse cx="200" cy="236" rx="26" ry="32" fill="none" stroke={c.gold} strokeOpacity="0.3" />
        </g>
      ))}
      <ellipse cx="200" cy="298" rx="98" ry="12" fill={c.ink} opacity="0.09" filter={`url(#blur-${gid})`} />
    </g>
  ),

  /* Neem wood comb */
  abaya: (c) => (
    <g>
      {/* shoulders and body — a straight-cut abaya on an invisible hanger */}
      <path
        d="M200 96c-16 0-30 5-42 13l-44 28c-8 5-11 15-8 24l16 44 24-9-6 168c0 6 5 11 11 11h98c6 0 11-5 11-11l-6-168 24 9 16-44c3-9 0-19-8-24l-44-28c-12-8-26-13-42-13z"
        fill={c.body}
      />
      <path
        d="M200 96c-16 0-30 5-42 13l-44 28c-8 5-11 15-8 24l16 44 24-9-6 168c0 6 5 11 11 11h44V96z"
        fill={c.bodyLight}
        opacity="0.28"
      />
      {/* front zip */}
      <rect x="197" y="120" width="6" height="242" rx="3" fill={c.bodyDeep} opacity="0.55" />
      <circle cx="200" cy="150" r="5" fill={c.gold} />
      {/* neckline */}
      <path d="M176 104c8 12 40 12 48 0" fill="none" stroke={c.bodyDeep} strokeWidth="4" opacity="0.5" />
      {/* cuff detail */}
      <rect x="112" y="188" width="34" height="12" rx="6" fill={c.gold} opacity="0.5" />
      <rect x="254" y="188" width="34" height="12" rx="6" fill={c.gold} opacity="0.5" />
    </g>
  ),
  comb: (c, gid) => (
    <g transform="rotate(-14 200 250)">
      <rect x="112" y="196" width="176" height="34" rx="10" fill={c.body} />
      <rect x="112" y="196" width="176" height="10" rx="5" fill={c.bodyLight} opacity="0.45" />
      {Array.from({ length: 15 }).map((_, i) => (
        <rect
          key={i}
          x={120 + i * 11.6}
          y="228"
          width="5.5"
          height="66"
          rx="2.75"
          fill={c.bodyDeep}
        />
      ))}
      <circle cx="272" cy="213" r="6" fill={c.bodyDeep} opacity="0.6" />
      <text
        x="176"
        y="218"
        textAnchor="middle"
        fontSize="10"
        letterSpacing="3"
        fill={c.label}
        opacity="0.8"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        NEEM
      </text>
      <ellipse cx="200" cy="312" rx="106" ry="12" fill={c.ink} opacity="0.09" filter={`url(#blur-${gid})`} />
    </g>
  ),
}

export function ProductArt({ product, className = '', decorative = true, priority = false }) {
  const uid = useId().replace(/[:]/g, '')
  const art = product?.art ?? { shape: 'jar', hue: 330 }
  const c = palette(art.hue)
  const draw = SHAPES[art.shape] ?? SHAPES.jar
  const seed = hashUnit(product?.slug ?? 'gbs')

  // Accept either the normalised `image` key or a raw `images[]` array, so the
  // admin editor's live preview reflects an upload without a round trip.
  const photo = product?.image ?? product?.images?.[0]?.url ?? null

  if (photo) {
    return (
      <img
        src={photo}
        alt={product.name}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={cx('h-full w-full object-cover', className)}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 400 460"
      className={cx('h-full w-full', className)}
      role="img"
      aria-label={product?.name ?? 'Product'}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={c.bg1} />
          <stop offset="0.55" stopColor={c.bg3} />
          <stop offset="1" stopColor={c.bg2} />
        </linearGradient>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.34" r="0.62">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`blur-${uid}`} x="-40%" y="-120%" width="180%" height="340%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <rect width="400" height="460" fill={`url(#bg-${uid})`} />

      {decorative && (
        <g opacity="0.5">
          {/* soft studio blooms — offset per product so no two tiles match */}
          <circle cx={70 + seed * 60} cy={80 + seed * 40} r={90} fill="#ffffff" opacity="0.3" />
          <circle cx={330 - seed * 40} cy={400} r={110} fill={c.bodyLight} opacity="0.16" />
          <circle
            cx="200"
            cy="232"
            r={128 + seed * 14}
            fill="none"
            stroke={c.gold}
            strokeOpacity="0.22"
            strokeDasharray="2 7"
          />
        </g>
      )}

      <rect width="400" height="460" fill={`url(#glow-${uid})`} />
      {draw(c, uid)}
    </svg>
  )
}

/** Every artwork style the admin product editor can choose from. */
export const ART_SHAPE_OPTIONS = Object.keys(SHAPES).sort()
