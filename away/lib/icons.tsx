import type { ReactElement, SVGProps } from "react";

/* 20 achievement icons — chunky 3D-illustrated SVG style.
   Each icon is an 80×80 viewBox. Unique gradient IDs per icon.
   Components forward SVGProps to the root <svg> so callers can pass className. */

export type AchievementIconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

/* ============================================================
   PIANO  —  notes played
   ============================================================ */

const Piano1: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="p1card" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#d4b18a" />
				<stop offset="1" stopColor="#7a5530" />
			</linearGradient>
		</defs>
		<g transform="rotate(-6 40 44)">
			<path d="M10 26 Q10 22 14 22 L66 22 Q70 22 70 26 L70 32 L10 32 Z" fill="#a17a4d" stroke="#3f2812" strokeWidth="1.6" />
			<rect x="10" y="32" width="60" height="30" rx="2" fill="url(#p1card)" stroke="#3f2812" strokeWidth="1.6" />
			<rect x="13" y="40" width="54" height="20" fill="#f4e5c8" stroke="#3f2812" strokeWidth="1.2" />
			<g stroke="#3f2812" strokeWidth="0.9">
				<line x1="21" y1="40" x2="21" y2="60" />
				<line x1="29" y1="40" x2="29" y2="60" />
				<line x1="45" y1="40" x2="45" y2="60" />
				<line x1="53" y1="40" x2="53" y2="60" />
				<line x1="61" y1="40" x2="61" y2="60" />
			</g>
			<rect x="37" y="40" width="8" height="20" fill="#241509" />
			<g transform="rotate(40 64 68)">
				<rect x="60" y="62" width="8" height="14" fill="#f4e5c8" stroke="#3f2812" strokeWidth="1" />
			</g>
			<rect x="22" y="20" width="32" height="7" fill="#e9e2c2" stroke="#7d7458" strokeWidth="0.6" opacity="0.92" />
			<line x1="28" y1="20" x2="28" y2="27" stroke="#7d7458" strokeWidth="0.4" />
			<line x1="44" y1="20" x2="44" y2="27" stroke="#7d7458" strokeWidth="0.4" />
			<path d="M16 36 l3 -3 l-2 -3 l4 -2" fill="none" stroke="#2b1808" strokeWidth="1.3" strokeLinecap="round" />
		</g>
	</svg>
);

const Piano2: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="p2top" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#ff8d96" />
				<stop offset="1" stopColor="#c33d4a" />
			</linearGradient>
			<linearGradient id="p2base" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#9bb6e4" />
				<stop offset="1" stopColor="#4a6aa0" />
			</linearGradient>
		</defs>
		<rect x="10" y="34" width="60" height="30" rx="6" fill="url(#p2base)" stroke="#23355c" strokeWidth="1.6" />
		<rect x="10" y="22" width="60" height="16" rx="6" fill="url(#p2top)" stroke="#23355c" strokeWidth="1.6" />
		<circle cx="60" cy="30" r="3" fill="#23355c" />
		<circle cx="60" cy="30" r="1" fill="#ffdcdf" />
		<circle cx="18" cy="30" r="3" fill="#fff" stroke="#23355c" strokeWidth="1" />
		<line x1="18" y1="30" x2="20" y2="28" stroke="#23355c" strokeWidth="1" strokeLinecap="round" />
		<rect x="16" y="42" width="48" height="18" rx="2" fill="#fff8e8" stroke="#23355c" strokeWidth="1.2" />
		<g stroke="#23355c" strokeWidth="0.8">
			<line x1="25.6" y1="42" x2="25.6" y2="60" />
			<line x1="35.2" y1="42" x2="35.2" y2="60" />
			<line x1="44.8" y1="42" x2="44.8" y2="60" />
			<line x1="54.4" y1="42" x2="54.4" y2="60" />
		</g>
		<rect x="22" y="42" width="4" height="10" fill="#1a2440" />
		<rect x="33" y="42" width="4" height="10" fill="#1a2440" />
		<rect x="52" y="42" width="4" height="10" fill="#1a2440" />
		<rect x="14" y="25" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.5)" />
	</svg>
);

const Piano3: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="p3wood" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#a36a40" />
				<stop offset="1" stopColor="#5a3416" />
			</linearGradient>
		</defs>
		<rect x="12" y="14" width="56" height="10" rx="2" fill="#7a4a26" stroke="#2c1808" strokeWidth="1.4" />
		<rect x="16" y="9" width="48" height="6" rx="1" fill="#8a5530" stroke="#2c1808" strokeWidth="1.2" />
		<rect x="14" y="24" width="52" height="28" fill="url(#p3wood)" stroke="#2c1808" strokeWidth="1.6" />
		<rect x="20" y="28" width="40" height="14" fill="#693c1c" stroke="#2c1808" strokeWidth="1" />
		<circle cx="40" cy="35" r="1.5" fill="#e0b76b" />
		<rect x="14" y="52" width="52" height="12" fill="#fff5e0" stroke="#2c1808" strokeWidth="1.4" />
		<g stroke="#2c1808" strokeWidth="0.7">
			<line x1="22" y1="52" x2="22" y2="64" />
			<line x1="30" y1="52" x2="30" y2="64" />
			<line x1="38" y1="52" x2="38" y2="64" />
			<line x1="46" y1="52" x2="46" y2="64" />
			<line x1="54" y1="52" x2="54" y2="64" />
		</g>
		<rect x="19" y="52" width="3" height="7" fill="#1a0d04" />
		<rect x="27" y="52" width="3" height="7" fill="#1a0d04" />
		<rect x="43" y="52" width="3" height="7" fill="#1a0d04" />
		<rect x="51" y="52" width="3" height="7" fill="#1a0d04" />
		<rect x="59" y="52" width="3" height="7" fill="#1a0d04" />
		<rect x="16" y="64" width="4" height="8" fill="#3f2410" stroke="#2c1808" strokeWidth="1" />
		<rect x="60" y="64" width="4" height="8" fill="#3f2410" stroke="#2c1808" strokeWidth="1" />
		<rect x="36" y="64" width="8" height="3" fill="#d6a85a" stroke="#2c1808" strokeWidth="0.8" />
		<rect x="16" y="26" width="14" height="2" fill="rgba(255,255,255,0.18)" />
	</svg>
);

const Piano4: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="p4body" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#3a3a44" />
				<stop offset="0.5" stopColor="#161620" />
				<stop offset="1" stopColor="#0a0a12" />
			</linearGradient>
			<linearGradient id="p4lid" x1="0" x2="1" y1="0" y2="0.5">
				<stop offset="0" stopColor="#54545e" />
				<stop offset="1" stopColor="#161620" />
			</linearGradient>
		</defs>
		<path d="M14 56 Q14 70 28 70 L60 70 Q72 70 72 58 Q72 42 60 38 L30 38 Q14 38 14 56 Z" fill="url(#p4body)" stroke="#000" strokeWidth="1.6" />
		<path d="M14 38 Q14 18 36 18 L62 18 Q72 18 72 30 L72 40 L14 56 Z" fill="url(#p4lid)" stroke="#000" strokeWidth="1.6" />
		<g stroke="#e8c870" strokeWidth="0.4" opacity="0.9">
			<line x1="22" y1="38" x2="60" y2="32" />
			<line x1="22" y1="42" x2="60" y2="34" />
			<line x1="22" y1="46" x2="60" y2="36" />
			<line x1="22" y1="50" x2="60" y2="38" />
		</g>
		<line x1="34" y1="20" x2="34" y2="40" stroke="#7a6230" strokeWidth="1.2" />
		<rect x="20" y="58" width="46" height="10" rx="1" fill="#fff8e8" stroke="#000" strokeWidth="1.2" />
		<g stroke="#000" strokeWidth="0.7">
			<line x1="27" y1="58" x2="27" y2="68" />
			<line x1="34" y1="58" x2="34" y2="68" />
			<line x1="41" y1="58" x2="41" y2="68" />
			<line x1="48" y1="58" x2="48" y2="68" />
			<line x1="55" y1="58" x2="55" y2="68" />
		</g>
		<rect x="24" y="58" width="3" height="6" fill="#0a0a12" />
		<rect x="38" y="58" width="3" height="6" fill="#0a0a12" />
		<rect x="45" y="58" width="3" height="6" fill="#0a0a12" />
		<rect x="59" y="58" width="3" height="6" fill="#0a0a12" />
		<path d="M18 36 Q22 22 42 20" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" />
		<rect x="42" y="70" width="4" height="6" fill="#161620" stroke="#000" strokeWidth="1" />
	</svg>
);

const Piano5: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="p5body" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#e4f9ff" />
				<stop offset="0.5" stopColor="#9bf8fd" />
				<stop offset="1" stopColor="#4ab4d2" />
			</linearGradient>
			<linearGradient id="p5lid" x1="0" x2="1" y1="0" y2="1">
				<stop offset="0" stopColor="#ffffff" />
				<stop offset="1" stopColor="#9bf8fd" />
			</linearGradient>
			<radialGradient id="p5glow" cx="0.5" cy="0.5" r="0.5">
				<stop offset="0" stopColor="rgba(252,241,196,0.9)" />
				<stop offset="1" stopColor="rgba(252,241,196,0)" />
			</radialGradient>
		</defs>
		<circle cx="40" cy="42" r="36" fill="url(#p5glow)" />
		<path d="M14 56 Q14 70 28 70 L60 70 Q72 70 72 58 Q72 42 60 38 L30 38 Q14 38 14 56 Z" fill="url(#p5body)" stroke="#3a8da0" strokeWidth="1.4" />
		<path d="M14 38 Q14 18 36 18 L62 18 Q72 18 72 30 L72 40 L14 56 Z" fill="url(#p5lid)" stroke="#3a8da0" strokeWidth="1.4" />
		<g stroke="#f4d36c" strokeWidth="0.6">
			<line x1="22" y1="38" x2="60" y2="32" />
			<line x1="22" y1="44" x2="60" y2="34" />
			<line x1="22" y1="50" x2="60" y2="36" />
		</g>
		<rect x="20" y="58" width="46" height="10" rx="1" fill="#fff" stroke="#3a8da0" strokeWidth="1" />
		<g stroke="#3a8da0" strokeWidth="0.6">
			<line x1="27" y1="58" x2="27" y2="68" />
			<line x1="34" y1="58" x2="34" y2="68" />
			<line x1="41" y1="58" x2="41" y2="68" />
			<line x1="48" y1="58" x2="48" y2="68" />
			<line x1="55" y1="58" x2="55" y2="68" />
		</g>
		<rect x="24" y="58" width="3" height="6" fill="#1a4858" />
		<rect x="38" y="58" width="3" height="6" fill="#1a4858" />
		<rect x="45" y="58" width="3" height="6" fill="#1a4858" />
		<rect x="59" y="58" width="3" height="6" fill="#1a4858" />
		<path d="M16 38 Q18 24 36 20 L48 20" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round" />
		<g fill="#f4d36c" stroke="#a37820" strokeWidth="0.6">
			<ellipse cx="62" cy="14" rx="2.4" ry="1.8" transform="rotate(-18 62 14)" />
			<rect x="63.5" y="6" width="1" height="8" />
		</g>
		<g fill="#fff">
			<path d="M70 20 l1 2 l2 1 l-2 1 l-1 2 l-1 -2 l-2 -1 l2 -1 z" />
			<path d="M14 24 l0.8 1.6 l1.6 0.8 l-1.6 0.8 l-0.8 1.6 l-0.8 -1.6 l-1.6 -0.8 l1.6 -0.8 z" />
			<circle cx="56" cy="10" r="0.8" />
		</g>
	</svg>
);

/* ============================================================
   CLOCK / HORLOGE — time played
   ============================================================ */

const Clock1: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="c1face" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#e6d6b8" />
				<stop offset="1" stopColor="#a08566" />
			</linearGradient>
		</defs>
		<path d="M20 18 Q20 10 26 10 Q30 10 30 16 L30 22 L18 22 Z" fill="#b8865a" stroke="#3a200e" strokeWidth="1.4" />
		<g transform="rotate(25 56 18)">
			<path d="M50 18 Q50 10 56 10 Q60 10 60 16 L60 22 L48 22 Z" fill="#a07550" stroke="#3a200e" strokeWidth="1.4" />
		</g>
		<rect x="38" y="14" width="4" height="10" rx="1" fill="#3a200e" />
		<circle cx="40" cy="46" r="26" fill="#7d5a35" stroke="#3a200e" strokeWidth="1.8" />
		<circle cx="40" cy="46" r="21" fill="url(#c1face)" stroke="#3a200e" strokeWidth="1.4" />
		<g stroke="#3a200e" strokeWidth="1" strokeLinecap="round">
			<line x1="40" y1="28" x2="40" y2="31" />
			<line x1="58" y1="46" x2="55" y2="46" />
			<line x1="40" y1="64" x2="40" y2="61" />
			<line x1="22" y1="46" x2="25" y2="46" />
		</g>
		<line x1="40" y1="46" x2="40" y2="33" stroke="#3a200e" strokeWidth="2.4" strokeLinecap="round" />
		<path d="M40 46 l8 -3 l-2 5" fill="none" stroke="#3a200e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<circle cx="40" cy="46" r="2" fill="#3a200e" />
		<path d="M27 36 L35 42 L31 49 L42 55 L48 62" fill="none" stroke="#2a1605" strokeWidth="1.4" strokeLinecap="round" />
		<rect x="20" y="68" width="6" height="6" fill="#3a200e" />
		<rect x="54" y="68" width="6" height="6" fill="#3a200e" />
		<circle cx="32" cy="58" r="2" fill="#7a3a14" opacity="0.6" />
		<circle cx="54" cy="38" r="1.6" fill="#7a3a14" opacity="0.5" />
	</svg>
);

const Clock2: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="c2strap" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#5a6072" />
				<stop offset="1" stopColor="#2a2d3a" />
			</linearGradient>
			<linearGradient id="c2screen" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#0d2014" />
				<stop offset="1" stopColor="#04100a" />
			</linearGradient>
		</defs>
		<path d="M28 8 L52 8 L50 26 L30 26 Z" fill="url(#c2strap)" stroke="#0a0c14" strokeWidth="1.4" />
		<path d="M30 54 L50 54 L52 72 L28 72 Z" fill="url(#c2strap)" stroke="#0a0c14" strokeWidth="1.4" />
		<circle cx="40" cy="14" r="1" fill="#0a0c14" />
		<circle cx="40" cy="68" r="1" fill="#0a0c14" />
		<rect x="18" y="24" width="44" height="32" rx="6" fill="#2a2d3a" stroke="#0a0c14" strokeWidth="1.8" />
		<rect x="22" y="28" width="36" height="24" rx="3" fill="url(#c2screen)" stroke="#0a0c14" strokeWidth="1" />
		<text x="40" y="44" textAnchor="middle" fill="#9bf8fd" fontFamily="monospace" fontSize="11" fontWeight="700">
			00:10
		</text>
		<rect x="14" y="34" width="4" height="6" rx="1" fill="#5a6072" stroke="#0a0c14" strokeWidth="0.8" />
		<rect x="62" y="34" width="4" height="6" rx="1" fill="#5a6072" stroke="#0a0c14" strokeWidth="0.8" />
		<rect x="62" y="42" width="4" height="6" rx="1" fill="#5a6072" stroke="#0a0c14" strokeWidth="0.8" />
		<rect x="22" y="29" width="36" height="3" rx="1" fill="rgba(155,248,253,0.18)" />
	</svg>
);

const Clock3: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="c3rim" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#3a3a48" />
				<stop offset="1" stopColor="#15151c" />
			</linearGradient>
			<radialGradient id="c3face" cx="0.45" cy="0.4" r="0.6">
				<stop offset="0" stopColor="#ffffff" />
				<stop offset="1" stopColor="#dad4c8" />
			</radialGradient>
		</defs>
		<circle cx="40" cy="40" r="32" fill="url(#c3rim)" stroke="#000" strokeWidth="1.6" />
		<circle cx="40" cy="40" r="26" fill="url(#c3face)" stroke="#000" strokeWidth="1" />
		<g fill="#15151c">
			{Array.from({ length: 12 }).map((_, i) => {
				const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
				const x = 40 + Math.cos(a) * 21;
				const y = 40 + Math.sin(a) * 21;
				const r = i % 3 === 0 ? 1.8 : 1;
				return <circle key={i} cx={x} cy={y} r={r} />;
			})}
		</g>
		<line x1="40" y1="40" x2="40" y2="26" stroke="#15151c" strokeWidth="3" strokeLinecap="round" />
		<line x1="40" y1="40" x2="54" y2="34" stroke="#15151c" strokeWidth="2" strokeLinecap="round" />
		<line x1="40" y1="40" x2="36" y2="58" stroke="#db5361" strokeWidth="1.2" strokeLinecap="round" />
		<circle cx="40" cy="40" r="2" fill="#db5361" />
		<path d="M22 28 Q30 22 42 22" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />
		<circle cx="40" cy="10" r="1.6" fill="#15151c" />
		<line x1="40" y1="10" x2="40" y2="14" stroke="#15151c" strokeWidth="1" />
	</svg>
);

const Clock4: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="c4case" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#fde29a" />
				<stop offset="0.5" stopColor="#d6a73a" />
				<stop offset="1" stopColor="#8b6618" />
			</linearGradient>
			<radialGradient id="c4face" cx="0.4" cy="0.35" r="0.65">
				<stop offset="0" stopColor="#fff8e0" />
				<stop offset="1" stopColor="#e2cf94" />
			</radialGradient>
		</defs>
		<g fill="none" stroke="#d6a73a" strokeWidth="1.4">
			<circle cx="50" cy="10" r="2" />
			<circle cx="56" cy="14" r="2" />
		</g>
		<rect x="36" y="10" width="8" height="6" rx="1.5" fill="url(#c4case)" stroke="#5a4010" strokeWidth="1.2" />
		<rect x="38" y="6" width="4" height="6" rx="1" fill="url(#c4case)" stroke="#5a4010" strokeWidth="1.2" />
		<circle cx="40" cy="46" r="28" fill="url(#c4case)" stroke="#5a4010" strokeWidth="1.8" />
		<circle cx="40" cy="46" r="22" fill="url(#c4face)" stroke="#5a4010" strokeWidth="1.2" />
		<g stroke="#5a4010" strokeWidth="1" strokeLinecap="round">
			<line x1="40" y1="28" x2="40" y2="32" />
			<line x1="58" y1="46" x2="54" y2="46" />
			<line x1="40" y1="64" x2="40" y2="60" />
			<line x1="22" y1="46" x2="26" y2="46" />
			<line x1="53" y1="33" x2="51" y2="35" />
			<line x1="53" y1="59" x2="51" y2="57" />
			<line x1="27" y1="59" x2="29" y2="57" />
			<line x1="27" y1="33" x2="29" y2="35" />
		</g>
		<circle cx="40" cy="46" r="16" fill="none" stroke="#b3902a" strokeWidth="0.6" strokeDasharray="1 2" />
		<line x1="40" y1="46" x2="40" y2="32" stroke="#1f4070" strokeWidth="2.4" strokeLinecap="round" />
		<line x1="40" y1="46" x2="52" y2="40" stroke="#1f4070" strokeWidth="1.6" strokeLinecap="round" />
		<circle cx="40" cy="46" r="2" fill="#1f4070" />
		<path d="M24 32 Q30 26 42 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.4" strokeLinecap="round" />
	</svg>
);

const Clock5: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="c5sand" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#fcf1c4" />
				<stop offset="0.5" stopColor="#db4df1" />
				<stop offset="1" stopColor="#2e0a73" />
			</linearGradient>
			<linearGradient id="c5frame" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#fde29a" />
				<stop offset="1" stopColor="#a37820" />
			</linearGradient>
			<radialGradient id="c5glow" cx="0.5" cy="0.5" r="0.5">
				<stop offset="0" stopColor="rgba(155,248,253,0.55)" />
				<stop offset="1" stopColor="rgba(155,248,253,0)" />
			</radialGradient>
		</defs>
		<circle cx="40" cy="40" r="36" fill="url(#c5glow)" />
		<rect x="18" y="10" width="44" height="6" rx="1.5" fill="url(#c5frame)" stroke="#5a4010" strokeWidth="1.4" />
		<rect x="18" y="64" width="44" height="6" rx="1.5" fill="url(#c5frame)" stroke="#5a4010" strokeWidth="1.4" />
		<path d="M22 16 L58 16 L44 40 L36 40 Z" fill="rgba(255,255,255,0.08)" stroke="#9bf8fd" strokeWidth="1.4" />
		<path d="M36 40 L44 40 L58 64 L22 64 Z" fill="rgba(255,255,255,0.08)" stroke="#9bf8fd" strokeWidth="1.4" />
		<path d="M26 20 L54 20 L43.5 38 L36.5 38 Z" fill="url(#c5sand)" opacity="0.92" />
		<line x1="40" y1="40" x2="40" y2="56" stroke="#fcf1c4" strokeWidth="1.4" />
		<path d="M38 56 Q40 50 42 56 L54 64 L26 64 Z" fill="url(#c5sand)" opacity="0.92" />
		<g fill="#fff">
			<path d="M30 30 l0.6 1.4 l1.4 0.6 l-1.4 0.6 l-0.6 1.4 l-0.6 -1.4 l-1.4 -0.6 l1.4 -0.6 z" />
			<path d="M48 58 l0.5 1.2 l1.2 0.5 l-1.2 0.5 l-0.5 1.2 l-0.5 -1.2 l-1.2 -0.5 l1.2 -0.5 z" />
			<circle cx="40" cy="48" r="0.8" />
			<circle cx="44" cy="26" r="0.6" />
		</g>
		<line x1="22" y1="12" x2="40" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" />
	</svg>
);

/* ============================================================
   MEDAL — courses finished
   ============================================================ */

const Medal1: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="m1card" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#f5d77a" />
				<stop offset="1" stopColor="#a88030" />
			</linearGradient>
		</defs>
		<path d="M22 10 L34 28 L26 38 L18 26 Z" fill="#c34050" stroke="#5a1a22" strokeWidth="1.4" />
		<path d="M58 10 L62 26 L54 38 L46 28 Z" fill="#c34050" stroke="#5a1a22" strokeWidth="1.4" />
		<path d="M22 10 L24 12 L20 14 L26 16 L22 18" fill="none" stroke="#5a1a22" strokeWidth="1" />
		<g transform="rotate(-8 40 50)">
			<path
				d="M40 28 L46 44 L62 44 L49 53 L54 68 L40 59 L26 68 L31 53 L18 44 L34 44 Z"
				fill="url(#m1card)"
				stroke="#604010"
				strokeWidth="1.6"
				strokeLinejoin="round"
			/>
			<path d="M40 28 L40 59" stroke="#876020" strokeWidth="0.6" strokeDasharray="2 2" />
			<path d="M18 44 L62 44" stroke="#876020" strokeWidth="0.6" strokeDasharray="2 2" />
			<path d="M50 50 L56 48 L54 56 Z" fill="rgba(0,0,0,0.18)" />
		</g>
		<text x="40" y="56" textAnchor="middle" fontFamily="Inter" fontWeight="700" fontSize="16" fill="#5a3a10">
			1
		</text>
	</svg>
);

const Medal2: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="m2coin" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#e9a570" />
				<stop offset="0.5" stopColor="#b06a30" />
				<stop offset="1" stopColor="#5e3414" />
			</linearGradient>
			<linearGradient id="m2coinInner" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#d68a50" />
				<stop offset="1" stopColor="#7a4218" />
			</linearGradient>
		</defs>
		<path d="M28 8 L40 26 L52 8 L48 28 L40 36 L32 28 Z" fill="#c34050" stroke="#5a1a22" strokeWidth="1.4" strokeLinejoin="round" />
		<path d="M40 26 L40 36" stroke="#7a1820" strokeWidth="1" />
		<circle cx="40" cy="52" r="18" fill="url(#m2coin)" stroke="#3a1f0a" strokeWidth="1.8" />
		<circle cx="40" cy="52" r="14" fill="url(#m2coinInner)" stroke="#3a1f0a" strokeWidth="1" />
		<path d="M28 52 Q26 46 30 42 Q32 46 30 50" fill="#d68a50" stroke="#3a1f0a" strokeWidth="0.8" />
		<path d="M28 52 Q26 58 30 62 Q32 58 30 54" fill="#d68a50" stroke="#3a1f0a" strokeWidth="0.8" />
		<path d="M52 52 Q54 46 50 42 Q48 46 50 50" fill="#d68a50" stroke="#3a1f0a" strokeWidth="0.8" />
		<path d="M52 52 Q54 58 50 62 Q48 58 50 54" fill="#d68a50" stroke="#3a1f0a" strokeWidth="0.8" />
		<text x="40" y="58" textAnchor="middle" fontFamily="Inter" fontWeight="700" fontSize="18" fill="#3a1f0a">
			1
		</text>
		<ellipse cx="34" cy="44" rx="6" ry="2" fill="rgba(255,255,255,0.4)" />
	</svg>
);

const Medal3: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="m3coin" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#f7f7f9" />
				<stop offset="0.5" stopColor="#a8a8b4" />
				<stop offset="1" stopColor="#5a5a66" />
			</linearGradient>
			<linearGradient id="m3coinInner" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#dadae2" />
				<stop offset="1" stopColor="#7a7a86" />
			</linearGradient>
		</defs>
		<path d="M28 8 L40 26 L52 8 L48 28 L40 36 L32 28 Z" fill="#637ead" stroke="#1f3666" strokeWidth="1.4" strokeLinejoin="round" />
		<path d="M40 26 L40 36" stroke="#1f3666" strokeWidth="1" />
		<circle cx="40" cy="52" r="18" fill="url(#m3coin)" stroke="#2a2a30" strokeWidth="1.8" />
		<circle cx="40" cy="52" r="14" fill="url(#m3coinInner)" stroke="#2a2a30" strokeWidth="1" />
		<path
			d="M40 42 L43 50 L51 50 L44.5 55 L47 63 L40 58 L33 63 L35.5 55 L29 50 L37 50 Z"
			fill="#fff"
			stroke="#2a2a30"
			strokeWidth="1"
			strokeLinejoin="round"
		/>
		<ellipse cx="34" cy="44" rx="6" ry="2" fill="rgba(255,255,255,0.6)" />
	</svg>
);

const Medal4: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="m4coin" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#fff2b0" />
				<stop offset="0.45" stopColor="#f0c54a" />
				<stop offset="1" stopColor="#8b6618" />
			</linearGradient>
			<linearGradient id="m4coinInner" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#fde29a" />
				<stop offset="1" stopColor="#b68820" />
			</linearGradient>
			<radialGradient id="m4glow" cx="0.5" cy="0.5" r="0.5">
				<stop offset="0" stopColor="rgba(252,241,196,0.45)" />
				<stop offset="1" stopColor="rgba(252,241,196,0)" />
			</radialGradient>
		</defs>
		<circle cx="40" cy="52" r="28" fill="url(#m4glow)" />
		<path d="M28 8 L40 26 L52 8 L48 28 L40 36 L32 28 Z" fill="#d6a73a" stroke="#5a4010" strokeWidth="1.4" strokeLinejoin="round" />
		<path d="M40 26 L40 36" stroke="#5a4010" strokeWidth="1" />
		<circle cx="40" cy="52" r="18" fill="url(#m4coin)" stroke="#3a280a" strokeWidth="1.8" />
		<circle cx="40" cy="52" r="14" fill="url(#m4coinInner)" stroke="#3a280a" strokeWidth="1" />
		<g stroke="#3a280a" strokeWidth="0.8" fill="#a37820">
			<ellipse cx="27" cy="48" rx="2.4" ry="3.5" transform="rotate(-30 27 48)" />
			<ellipse cx="27" cy="56" rx="2.4" ry="3.5" transform="rotate(30 27 56)" />
			<ellipse cx="29" cy="42" rx="2.4" ry="3.5" transform="rotate(-50 29 42)" />
			<ellipse cx="29" cy="62" rx="2.4" ry="3.5" transform="rotate(50 29 62)" />
			<ellipse cx="53" cy="48" rx="2.4" ry="3.5" transform="rotate(30 53 48)" />
			<ellipse cx="53" cy="56" rx="2.4" ry="3.5" transform="rotate(-30 53 56)" />
			<ellipse cx="51" cy="42" rx="2.4" ry="3.5" transform="rotate(50 51 42)" />
			<ellipse cx="51" cy="62" rx="2.4" ry="3.5" transform="rotate(-50 51 62)" />
		</g>
		<path
			d="M40 44 L43 50 L50 50 L44.5 54 L46.5 61 L40 57 L33.5 61 L35.5 54 L30 50 L37 50 Z"
			fill="#fff7c0"
			stroke="#3a280a"
			strokeWidth="1"
			strokeLinejoin="round"
		/>
		<ellipse cx="34" cy="44" rx="6" ry="2" fill="rgba(255,255,255,0.7)" />
	</svg>
);

const Medal5: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="m5cup" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#fff2b0" />
				<stop offset="0.5" stopColor="#f0c54a" />
				<stop offset="1" stopColor="#8b6618" />
			</linearGradient>
			<linearGradient id="m5gem" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#ffffff" />
				<stop offset="0.5" stopColor="#9bf8fd" />
				<stop offset="1" stopColor="#3a8da0" />
			</linearGradient>
			<radialGradient id="m5glow" cx="0.5" cy="0.5" r="0.5">
				<stop offset="0" stopColor="rgba(252,241,196,0.7)" />
				<stop offset="1" stopColor="rgba(252,241,196,0)" />
			</radialGradient>
		</defs>
		<circle cx="40" cy="42" r="36" fill="url(#m5glow)" />
		<path d="M22 26 Q12 28 12 38 Q12 48 22 48" fill="none" stroke="#3a280a" strokeWidth="3" />
		<path d="M22 26 Q12 28 12 38 Q12 48 22 48" fill="none" stroke="#f0c54a" strokeWidth="1.6" />
		<path d="M58 26 Q68 28 68 38 Q68 48 58 48" fill="none" stroke="#3a280a" strokeWidth="3" />
		<path d="M58 26 Q68 28 68 38 Q68 48 58 48" fill="none" stroke="#f0c54a" strokeWidth="1.6" />
		<path d="M22 18 L58 18 L56 48 Q56 56 40 56 Q24 56 24 48 Z" fill="url(#m5cup)" stroke="#3a280a" strokeWidth="1.8" />
		<path d="M40 28 L46 36 L40 46 L34 36 Z" fill="url(#m5gem)" stroke="#1a4858" strokeWidth="1" />
		<path d="M40 28 L43 33 L40 38 L37 33 Z" fill="rgba(255,255,255,0.6)" />
		<rect x="36" y="56" width="8" height="6" fill="url(#m5cup)" stroke="#3a280a" strokeWidth="1.4" />
		<path d="M26 62 L54 62 L58 72 L22 72 Z" fill="url(#m5cup)" stroke="#3a280a" strokeWidth="1.6" />
		<line x1="28" y1="65" x2="36" y2="65" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
		<line x1="26" y1="22" x2="36" y2="22" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" />
		<g fill="#fff">
			<path d="M14 14 l0.7 1.5 l1.5 0.7 l-1.5 0.7 l-0.7 1.5 l-0.7 -1.5 l-1.5 -0.7 l1.5 -0.7 z" />
			<path d="M66 16 l0.5 1.2 l1.2 0.5 l-1.2 0.5 l-0.5 1.2 l-0.5 -1.2 l-1.2 -0.5 l1.2 -0.5 z" />
			<circle cx="50" cy="12" r="0.8" />
		</g>
	</svg>
);

/* ============================================================
   MUSIC NOTES — songs
   ============================================================ */

const Note1: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="n1note" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#a8a3b6" />
				<stop offset="1" stopColor="#4f4a5e" />
			</linearGradient>
		</defs>
		<g transform="rotate(-6 40 40)">
			<rect x="44" y="18" width="3" height="22" fill="url(#n1note)" stroke="#1a1626" strokeWidth="1.2" />
			<ellipse cx="34" cy="36" rx="12" ry="8" fill="url(#n1note)" stroke="#1a1626" strokeWidth="1.6" />
			<path d="M22 40 L28 42 L26 46 L32 48 L30 52 L36 54" fill="none" stroke="#0a0612" strokeWidth="1.4" strokeLinecap="round" />
			<g transform="translate(4 8) rotate(-12 34 44)">
				<path d="M26 42 Q26 50 34 50 Q42 50 42 42" fill="url(#n1note)" stroke="#1a1626" strokeWidth="1.6" />
			</g>
			<g fill="#6a6286">
				<circle cx="14" cy="56" r="1" />
				<circle cx="20" cy="60" r="0.8" />
				<circle cx="48" cy="58" r="0.6" />
			</g>
		</g>
	</svg>
);

const Note2: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="n2note" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#ff8d96" />
				<stop offset="1" stopColor="#a02838" />
			</linearGradient>
			<linearGradient id="n2flag" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#ff8d96" />
				<stop offset="1" stopColor="#a02838" />
			</linearGradient>
		</defs>
		<rect x="48" y="16" width="3.4" height="42" fill="#a02838" stroke="#3a0a10" strokeWidth="1.2" />
		<path d="M51.4 16 Q66 22 60 38 Q60 30 51.4 28 Z" fill="url(#n2flag)" stroke="#3a0a10" strokeWidth="1.4" strokeLinejoin="round" />
		<ellipse cx="40" cy="56" rx="13" ry="9" transform="rotate(-22 40 56)" fill="url(#n2note)" stroke="#3a0a10" strokeWidth="1.8" />
		<ellipse cx="34" cy="51" rx="5" ry="2" transform="rotate(-22 34 51)" fill="rgba(255,255,255,0.55)" />
		<path d="M54 19 Q60 22 58 26" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" strokeLinecap="round" />
	</svg>
);

const Note3: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="n3a" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#bdf9fc" />
				<stop offset="1" stopColor="#3a8da0" />
			</linearGradient>
			<linearGradient id="n3b" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#ff8d96" />
				<stop offset="1" stopColor="#a02838" />
			</linearGradient>
		</defs>
		<path d="M20 14 L62 22 L62 30 L20 22 Z" fill="#2a2440" stroke="#0a0612" strokeWidth="1.4" />
		<rect x="20" y="20" width="3" height="36" fill="#3a8da0" stroke="#0a0612" strokeWidth="1" />
		<rect x="59" y="26" width="3" height="32" fill="#a02838" stroke="#0a0612" strokeWidth="1" />
		<ellipse cx="16" cy="56" rx="10" ry="7" transform="rotate(-22 16 56)" fill="url(#n3a)" stroke="#0a0612" strokeWidth="1.4" />
		<ellipse cx="12" cy="52" rx="3.5" ry="1.4" transform="rotate(-22 12 52)" fill="rgba(255,255,255,0.6)" />
		<ellipse cx="56" cy="60" rx="10" ry="7" transform="rotate(-22 56 60)" fill="url(#n3b)" stroke="#0a0612" strokeWidth="1.4" />
		<ellipse cx="52" cy="56" rx="3.5" ry="1.4" transform="rotate(-22 52 56)" fill="rgba(255,255,255,0.6)" />
		<path d="M22 16 L60 24" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" />
	</svg>
);

const Note4: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="n4clef" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#fde29a" />
				<stop offset="0.5" stopColor="#f0c54a" />
				<stop offset="1" stopColor="#8b6618" />
			</linearGradient>
		</defs>
		<g stroke="rgba(255,255,255,0.4)" strokeWidth="0.7">
			<line x1="10" y1="26" x2="70" y2="26" />
			<line x1="10" y1="34" x2="70" y2="34" />
			<line x1="10" y1="42" x2="70" y2="42" />
			<line x1="10" y1="50" x2="70" y2="50" />
			<line x1="10" y1="58" x2="70" y2="58" />
		</g>
		<path
			d="M40 8 C 36 14, 34 22, 38 30 C 42 36, 50 38, 52 46 C 54 54, 46 60, 38 56 C 32 52, 32 44, 40 42 C 48 40, 56 46, 54 56 C 52 66, 42 70, 36 66 C 32 64, 32 60, 34 58"
			fill="none"
			stroke="url(#n4clef)"
			strokeWidth="5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M40 8 C 36 14, 34 22, 38 30 C 42 36, 50 38, 52 46 C 54 54, 46 60, 38 56 C 32 52, 32 44, 40 42 C 48 40, 56 46, 54 56 C 52 66, 42 70, 36 66 C 32 64, 32 60, 34 58"
			fill="none"
			stroke="#5a4010"
			strokeWidth="1.4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<circle cx="40" cy="68" r="2" fill="#5a4010" />
		<circle cx="40" cy="70" r="0.6" fill="#fff2b0" />
		<g fill="#fff2b0">
			<path d="M64 18 l0.6 1.4 l1.4 0.6 l-1.4 0.6 l-0.6 1.4 l-0.6 -1.4 l-1.4 -0.6 l1.4 -0.6 z" />
			<circle cx="16" cy="20" r="0.8" />
		</g>
	</svg>
);

const Note5: AchievementIconComponent = (props) => (
	<svg viewBox="0 0 80 80" {...props}>
		<defs>
			<linearGradient id="n5gold" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#fff2b0" />
				<stop offset="0.5" stopColor="#f0c54a" />
				<stop offset="1" stopColor="#8b6618" />
			</linearGradient>
			<linearGradient id="n5cy" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#e4f9ff" />
				<stop offset="1" stopColor="#4ab4d2" />
			</linearGradient>
			<linearGradient id="n5red" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stopColor="#ff8d96" />
				<stop offset="1" stopColor="#a02838" />
			</linearGradient>
			<radialGradient id="n5glow" cx="0.5" cy="0.5" r="0.5">
				<stop offset="0" stopColor="rgba(252,241,196,0.7)" />
				<stop offset="1" stopColor="rgba(252,241,196,0)" />
			</radialGradient>
		</defs>
		<circle cx="40" cy="40" r="36" fill="url(#n5glow)" />
		<path
			d="M20 32 L26 22 L32 30 L40 18 L48 30 L54 22 L60 32 L58 42 L22 42 Z"
			fill="url(#n5gold)"
			stroke="#5a4010"
			strokeWidth="1.6"
			strokeLinejoin="round"
		/>
		<circle cx="26" cy="28" r="1.4" fill="#db5361" stroke="#5a1a22" strokeWidth="0.6" />
		<circle cx="40" cy="24" r="1.8" fill="#9bf8fd" stroke="#1a4858" strokeWidth="0.6" />
		<circle cx="54" cy="28" r="1.4" fill="#db5361" stroke="#5a1a22" strokeWidth="0.6" />
		<rect x="44" y="42" width="2.8" height="20" fill="#a02838" stroke="#3a0a10" strokeWidth="0.8" />
		<ellipse cx="38" cy="62" rx="7" ry="5" transform="rotate(-22 38 62)" fill="url(#n5red)" stroke="#3a0a10" strokeWidth="1.2" />
		<g>
			<rect x="20" y="48" width="2" height="14" fill="#3a8da0" />
			<ellipse cx="16" cy="62" rx="5" ry="3.5" transform="rotate(-22 16 62)" fill="url(#n5cy)" stroke="#1a4858" strokeWidth="1" />
		</g>
		<g>
			<rect x="60" y="48" width="2" height="14" fill="#5a4010" />
			<ellipse cx="56" cy="62" rx="5" ry="3.5" transform="rotate(-22 56 62)" fill="url(#n5gold)" stroke="#5a4010" strokeWidth="1" />
		</g>
		<path d="M22 36 L28 30 L34 36 L40 28 L46 36 L52 30 L58 36" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round" />
		<g fill="#fff">
			<path d="M12 16 l0.7 1.6 l1.6 0.7 l-1.6 0.7 l-0.7 1.6 l-0.7 -1.6 l-1.6 -0.7 l1.6 -0.7 z" />
			<path d="M68 22 l0.6 1.4 l1.4 0.6 l-1.4 0.6 l-0.6 1.4 l-0.6 -1.4 l-1.4 -0.6 l1.4 -0.6 z" />
			<circle cx="68" cy="56" r="0.8" />
			<circle cx="12" cy="44" r="0.6" />
		</g>
	</svg>
);
const Ultimate: AchievementIconComponent = (props) => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 99 120" fill="none" {...props}>
		<g filter="url(#filter0_d_312_9)">
			<path
				d="M30.6505 110.609C27.4937 110.549 24.7258 110.24 22.3467 109.682C19.9676 109.125 17.901 107.847 16.1468 105.851C14.478 103.856 13.6827 100.811 13.761 96.7156C13.8703 90.9994 15.7235 83.3534 19.3206 73.7777C23.0029 64.2037 27.7526 54.6074 33.5695 44.9889C29.2988 45.1633 25.9165 45.7387 23.4227 46.7152C20.9289 47.6917 19.2777 49.2391 18.469 51.3574C18.8103 51.3639 19.1434 51.797 19.4684 52.6567C19.8787 53.518 20.0748 54.418 20.0569 55.3564C20.0275 56.8922 19.3213 58.1162 17.9383 59.0286C16.5569 59.8557 14.8424 60.2497 12.7947 60.2105C10.4058 60.1648 8.49843 59.4882 7.0725 58.1807C5.64657 56.8732 4.95645 55.025 5.00213 52.6361C5.05759 49.7353 6.2173 47.1117 8.48124 44.7652C10.8305 42.4204 14.0231 40.6037 18.0592 39.3153C22.0968 37.9416 26.5472 37.3012 31.4103 37.3942C33.202 37.4285 35.4178 37.5989 38.0578 37.9054C45.2659 26.9479 52.8188 18.0453 60.7165 11.1977C68.7012 4.26642 76.2342 0.868485 83.3155 1.00389C87.4108 1.0822 90.7694 1.74386 93.3914 2.98889L71.498 96.7955L53.0694 96.4431L63.8119 50.176C60.6829 48.6652 57.8025 47.5433 55.1707 46.8102C52.5389 46.0771 49.7324 45.554 46.7511 45.2409C41.6874 55.642 37.4719 66.3154 34.1047 77.261C30.8244 88.123 29.1215 96.8387 28.9959 103.408C28.9339 106.65 29.4854 109.051 30.6505 110.609ZM73.1596 9.89936C69.4534 11.7915 65.544 15.3868 61.4313 20.6851C57.4055 25.8998 53.443 32.2678 49.5439 39.7893C55.6639 41.1012 60.8397 42.6938 65.0714 44.5671L73.1596 9.89936Z"
				fill="white"
			/>
			<path
				d="M83.3252 0.503906C87.464 0.583055 90.8988 1.25196 93.6055 2.53711L93.9697 2.70996L93.8779 3.10254L71.9854 96.9092L71.8926 97.3027L71.4883 97.2949L53.0596 96.9434L52.4424 96.9316L52.582 96.3301L63.2334 50.4551C60.2639 49.0413 57.5322 47.9873 55.0361 47.292C52.5364 46.5957 49.8738 46.0913 47.0479 45.7773C42.0637 56.0553 37.9084 66.5986 34.583 77.4082L34.582 77.4072C31.3073 88.2513 29.6204 96.9161 29.4961 103.418C29.435 106.616 29.9839 108.882 31.0508 110.31L31.6631 111.129L30.6406 111.109C27.4584 111.049 24.654 110.736 22.2324 110.169C19.743 109.585 17.588 108.248 15.7715 106.181L15.7627 106.172V106.171C13.9832 104.043 13.1814 100.856 13.2607 96.7061C13.3717 90.9048 15.2487 83.1953 18.8525 73.6016L18.8535 73.5986C22.4449 64.2613 27.0489 54.9069 32.6602 45.5342C28.8581 45.7492 25.8464 46.3033 23.6055 47.1807C21.3926 48.0472 19.9163 49.362 19.1152 51.1113C19.2126 51.1926 19.2977 51.2865 19.3711 51.3818C19.58 51.6534 19.7646 52.0268 19.9336 52.4727C20.3668 53.3937 20.5759 54.36 20.5566 55.3662C20.5238 57.0812 19.7215 58.4517 18.2139 59.4463L18.2041 59.4521L18.1953 59.458C16.7143 60.3447 14.9012 60.7504 12.7852 60.71C10.3043 60.6625 8.26986 59.9568 6.73438 58.5488C5.1788 57.1223 4.45431 55.1224 4.50195 52.627C4.56014 49.5841 5.78132 46.8431 8.12109 44.418L8.12793 44.4111C10.5469 41.9967 13.8158 40.145 17.9072 38.8389C22.0045 37.4462 26.5105 36.8007 31.4199 36.8945C33.1629 36.9279 35.2935 37.0885 37.8086 37.374C44.9849 26.5048 52.5108 17.6508 60.3887 10.8203C68.4218 3.84691 76.0713 0.365202 83.3252 0.503906ZM72.418 10.876C69.0872 12.8298 65.5542 16.1867 61.8262 20.9893L61.8271 20.9902C57.9273 26.0418 54.0817 32.1913 50.29 39.4414C55.8947 40.6741 60.7062 42.149 64.7197 43.8701L72.418 10.876Z"
				stroke="black"
			/>
		</g>
		<defs>
			<filter id="filter0_d_312_9" x="0" y="0" width="98.5485" height="119.648" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
				<feFlood floodOpacity="0" result="BackgroundImageFix" />
				<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
				<feOffset dy="4" />
				<feGaussianBlur stdDeviation="2" />
				<feComposite in2="hardAlpha" operator="out" />
				<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
				<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_312_9" />
				<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_312_9" result="shape" />
			</filter>
		</defs>
	</svg>
);

export const PIANO_ICONS: AchievementIconComponent[] = [Piano1, Piano2, Piano3, Piano4, Piano5];
export const CLOCK_ICONS: AchievementIconComponent[] = [Clock1, Clock2, Clock3, Clock4, Clock5];
export const MEDAL_ICONS: AchievementIconComponent[] = [Medal1, Medal2, Medal3, Medal4, Medal5];
export const NOTE_ICONS: AchievementIconComponent[] = [Note1, Note2, Note3, Note4, Note5];
export const ULTIMATE_ICONS: AchievementIconComponent[] = [Ultimate];
