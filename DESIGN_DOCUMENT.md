# ImageQuip - Design Document

This document outlines the core design principles, visual styles, and component guidelines for the ImageQuip application. Its purpose is to ensure a consistent and high-quality user experience across all parts of the game.

## 1. Core Principles

- **Fun & Engaging:** The design should be playful and inviting, encouraging creativity and laughter.
- **Intuitive & Clear:** Users should be able to understand game mechanics and navigate the UI with minimal friction.
- **Responsive & Accessible:** The design should adapt well to different screen sizes (within reason for a desktop-focused app) and consider accessibility best practices.
- **Modern & Clean:** While playful, the UI should maintain a modern, uncluttered aesthetic.

## 2. Branding & Color Palette

- **Primary Color:** `#4A90E2` (A vibrant, friendly blue) - Used for primary buttons, active states, headers.
- **Secondary Color:** `#F5A623` (A warm, energetic orange) - Used for accents, highlights, secondary actions.
- **Accent Color (Optional):** `#7ED321` (A positive green) - For success states, confirmations.
- **Neutral Colors:**
  - Dark Grey (Text, Borders): `#333333`
  - Medium Grey (Subtle UI elements, inactive states): `#7F7F7F`
  - Light Grey (Backgrounds, Dividers): `#F2F2F2`
  - Off-White (Card backgrounds, content areas): `#FFFFFF`
- **Error/Warning Color:** `#D0021B` (A clear red)

_(Consider using a color palette generator like Coolors.co or Adobe Color to refine and expand this palette with tints and shades.)_

## 3. Typography

- **Primary Font (Headings, UI Text):** **"Montserrat"** (sans-serif)
  - Available on Google Fonts.
  - Provides a clean, modern, and friendly look.
  - Weights: Regular (400), Medium (500), SemiBold (600), Bold (700).
- **Secondary Font (Body Text, Card Prompts - Optional):** **"Open Sans"** (sans-serif)
  - Available on Google Fonts.
  - Highly legible for longer text passages if needed.
  - Weights: Regular (400), SemiBold (600).
- **Fallback Font:** Standard system sans-serif fonts (e.g., Arial, Helvetica).

### Font Sizes:

- **Page Titles (h1):** 32px, Montserrat Bold
- **Section Headers (h2):** 24px, Montserrat SemiBold
- **Sub-Headers (h3):** 20px, Montserrat Medium
- **Card Prompts:** 18px, Montserrat Regular (or Open Sans Regular if chosen for prompts)
- **Button Text:** 16px, Montserrat Medium
- **Body/UI Text:** 16px, Montserrat Regular
- **Small/Helper Text:** 14px, Montserrat Regular

_(These are starting points. Adjust based on visual hierarchy and readability during implementation.)_

## 4. Card Design & Dimensions

- **Aspect Ratio:** **9:16** (Portrait orientation, similar to a phone screen or many popular card game formats).
  - This is crucial for consistency in displaying user-uploaded images and for the overall card aesthetic.
- **Standard Display Size (in UI, e.g., `MyCardsScreen`, `CardWallBackground`):**
  - Width: `110px`
  - Height: `195.5px` (approx. 110px _ 16/9)
    _(This is the current size used in `MyCardsScreen.js` and seems like a reasonable base for grids).\*
- **Card Inspector Modal Size:** Larger, e.g., `270px` width (height `480px`).
- **In-Game Prompt/Answer Display:** Size may vary depending on the game phase UI, but should aim to maintain the aspect ratio.
- **Visual Elements:**
  - **Border:** Subtle 1px border (e.g., `#CCCCCC` or a slightly darker shade of the card background).
  - **Rounded Corners:** 4px - 8px (e.g., `border-radius: 6px;`).
  - **Shadow (Optional):** Subtle box-shadow for a sense of depth, especially when cards are interactive or layered.
  - **Content:** The user's image should fill the card area, respecting the aspect ratio (cropping/letterboxing as currently implemented).
  - **Text on Cards (if any, e.g., for "Flip the Script" answers):** Legible, centered, or appropriately placed with good contrast against typical image content.

## 5. UI Components & Styling

- **Buttons:**
  - **Primary:** Solid background (Primary Color), white text, rounded corners, subtle hover/active states.
  - **Secondary/Ghost:** Border (Primary or Secondary Color), text (Primary or Secondary Color), rounded corners.
  - **Destructive (Delete):** Red background or red border/text.
  - Padding: Consistent padding (e.g., 10px 20px).
- **Input Fields:**
  - Clean, simple design.
  - Clear focus states (e.g., border color change).
  - Consistent height and padding.
- **Modals:**
  - Centered on screen.
  - Overlay to dim background content.
  - Clear "Close" button (X icon).
  - Well-defined header, content, and action areas.
- **Layout & Spacing:**
  - Use a consistent spacing scale (e.g., multiples of 4px or 8px) for margins, padding, and gaps between elements. This creates visual rhythm.
  - Ensure sufficient white space to avoid a cluttered feel.
- **Icons:**
  - Use a consistent icon set (e.g., Material Icons, Font Awesome, or custom SVG icons).
  - Ensure icons are clear and their meaning is intuitive. Player icons are already quite distinct.

## 6. Specific Screen Notes

- **`TitleScreen`:** Prominent game title/logo, clear call-to-action buttons (Host, Join, My Cards, Account).
- **`LobbyScreen`:** Clearly display game code, player list (with icons/nicknames), game settings, "Start Game" button for host.
- **`CardSelectionScreen`:** Intuitive interface for players to select cards for the game based on the game mode's requirements.
- **`PromptScreen`:** Clear display of the prompt, player's hand of cards (for image modes) or text input (for text modes), easy submission.
- **`VotingScreen`:** Clearly display the two submissions being voted on, easy way to cast a vote.
- **`VoteRevealScreen`:** Show what was voted on, who voted for what (anonymized or not, TBD), and scores awarded.
- **`FinalResultsScreen`:** Leaderboard, display of all prompts and winning submissions from the game.
- **`MyCardsScreen`:**
  - Card Upload: Clear instructions, preview, cropping tool.
  - Deck Management: Intuitive creation, selection, and card addition/removal.
  - Card Grid: Visually appealing and performant display of cards.
- **`AccountScreen/LoginScreen/RegisterScreen`:** Standard, secure, and easy-to-use forms.

## 7. Animation & Transitions

- Use subtle animations and transitions to enhance user experience, provide feedback, and guide attention.
  - Examples: Button hover effects, modal pop-ins, card flip animations (already present in `PromptScreen`), smooth screen transitions.
- Avoid overly complex or lengthy animations that could slow down the interface or feel jarring.
- Ensure animations are performant (CSS transitions/animations preferred over JS-heavy ones where possible).

## 8. Future Considerations

- **Dark Mode:** Plan for a potential dark mode theme.
- **Mobile Responsiveness:** While desktop-first, consider how key elements might adapt to smaller screens if future mobile support is envisioned.

## 9. Review & Updates

This document is a living guide. It should be reviewed and updated as the application evolves and new design challenges arise.
