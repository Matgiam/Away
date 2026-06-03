import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Lobster } from "next/font/google";
import "./globals.css";
import { AudioEngineProvider } from "@/components/providers/AudioEngineProvider";
import { PresenceProvider } from "@/components/providers/PresenceProvider";
import { TranscriptionProvider } from "@/components/providers/TranscriptionProvider";
import { TimeTracker } from "@/components/achievements/TimeTracker";
import { AchievementBannerHost } from "@/components/achievements/AchievementBannerHost";
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
            __html: `(function(){function s(){var h=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;document.documentElement.style.setProperty('--app-h',h+'px');}s();window.addEventListener('resize',s);if(window.visualViewport){window.visualViewport.addEventListener('resize',s);window.visualViewport.addEventListener('scroll',s);}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PresenceProvider>
          <AudioEngineProvider>
            <TranscriptionProvider>
              <TimeTracker />
              <SessionStatsSync />
              <AchievementBannerHost />
              <NavigationIndicator />
              <LatencyOverlay />
              {children}
            </TranscriptionProvider>
          </AudioEngineProvider>
        </PresenceProvider>
      </body>
    </html>
  );
}
