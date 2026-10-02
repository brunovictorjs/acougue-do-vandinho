import { Anton, Inter, JetBrains_Mono, Oswald } from "next/font/google"

export const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" })
export const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-oswald", display: "swap" })
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })
export const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" })

export const fontVariables = [anton.variable, oswald.variable, inter.variable, jetbrains.variable].join(" ")
