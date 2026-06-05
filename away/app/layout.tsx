import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Lobster } from "next/font/google";
import "./globals.css";
import { AudioEngineProvider } from "@/components/providers/AudioEngineProvider";
import { PresenceProvider } from "@/components/providers/PresenceProvider";
import { TranscriptionProvider } from "@/components/providers/TranscriptionProvider";
import { TimeTracker } from "@/components/achievements/TimeTracker";
import { AchievementBannerHost } from "@/components/achievements/AchievementBannerHost";
import { RecordingSavedBannerHost } from "@/components/layout/RecordingSavedBannerHost";
import { SessionStatsSync } from "@/components/achievements/SessionStatsSync";
import { NavigationIndicator } from "@/components/layout/NavigationIndicator";
import { LatencyOverlay } from "@/components/layout/LatencyOverlay";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const lobster = Lobster({
  variable: "--font-lobster",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Away",
  description: "Play piano with your friends in real-time. No experience needed.",
  icons: [{ rel: "icon", url: "/icons/Away.svg" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${lobster.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function s(){var vv=window.visualViewport;var h=(vv&&vv.height)||window.innerHeight;var w=(vv&&vv.width)||window.innerWidth;var d=document.documentElement;d.style.setProperty('--app-h',h+'px');d.style.setProperty('--app-scale',String(Math.min(w/1920,h/1080)));}s();window.addEventListener('resize',s);if(window.visualViewport){window.visualViewport.addEventListener('resize',s);window.visualViewport.addEventListener('scroll',s);}})();`,
          }}
        />
      </head>
      <body className="min-h-full">
        <PresenceProvider>
          <AudioEngineProvider>
            <TranscriptionProvider>
              {/* Everything lives inside the fixed-size, uniformly-scaled stage
                  so the layout is identical on every screen. Global hosts go
                  inside too, so their fixed-positioned overlays/modals share
                  the stage coordinate system and scale with the rest. */}
              <div className="app-viewport">
                {/* Full-bleed background layer (silk shader portals in here),
                    rendered behind the stage so it covers the letterbox bars. */}
                <div id="app-bg-layer" className="app-bg-layer" />
                <div id="app-stage" className="app-stage">
                  <TimeTracker />
                  <SessionStatsSync />
                  <AchievementBannerHost />
                  <RecordingSavedBannerHost />
                  <NavigationIndicator />
                  <LatencyOverlay />
                  {children}
                </div>
              </div>
            </TranscriptionProvider>
          </AudioEngineProvider>
        </PresenceProvider>
      </body>
    </html>
  );
}
