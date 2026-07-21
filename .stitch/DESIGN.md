# PocketBike Design System Specification

Welcome to the **PocketBike Design System**. This document defines the visual DNA, layout patterns, and UI components for the PocketBike rent-to-own payment system (`Payments-Wompi`). It provides the source of truth for all styling, styling tokens, and interactive behaviors across the customer-facing payment screens and the admin portal.

---

## 1. Visual Identity & Brand DNA

The PocketBike product serves a daily rental and micro-payment flow in Colombia. It features a dual-personality user interface:
1. **Admin Portal:** Clean, high-contrast, structured, and modern layout. It utilizes a white-on-light theme with strong brand teal accents to convey professional operation and billing trust.
2. **Customer Payment Screen:** Immersive, high-end mobile-first UI with glassmorphism, floating particle animations, and vibrant gradient backdrops. This creates an exciting, premium experience for customers completing daily bike payments.

### Brand Tone & Terminology
Always use Colombian Spanish terminology for core billing states:
- **Unpaid / Overdue:** *Pendiente* (Pending) or *Deuda* (Debt)
- **Paid / Approved:** *Pagado* (Paid) or *Aprobado* (Approved)
- **Processing:** *Procesando* or *Confirmando*
- **Alternative Days:** *Día Libre* (Free Day) or *Préstamo* (Loan)

---

## 2. Design Tokens

### Color Palette

#### Brand Colors
- **Teal Accent (Primary Brand):** `#03C9D7` — Used for active nav items, primary buttons, positive trends, and primary brand accents.
- **Teal Accent Dark:** `#0394A3` — Used for button hover states and gradient endpoints.
- **Teal Accent Light:** `#EFF6FF` — Used for active selection backgrounds.
- **Accent Pink (Customer CTA):** `#e81c74` — Used for the main "Pay Now" actions on the customer payment app.
- **Nequi Green (Brand Specific):** `#089270` — Used for the Nequi integration cards.

#### Status Colors
- **Success / Paid:** Text: `#065F46` | Background: `#D1FAE5` (Border: `#10B981`)
- **Warning / Pending:** Text: `#92400E` | Background: `#FEF3C7` (Border: `#d97706`)
- **Danger / Declined:** Text: `#991B1B` | Background: `#FEE2E2` (Border: `#EF4444`)
- **Adjustment:** Text: `#6B7280` | Background: `#F3F4F6` (Border: `#E5E7EB`)

#### Neutral Scales
- **Text Primary:** `#1F2937` — Used for headings, bold elements, and table entries.
- **Text Secondary:** `#6B7280` — Used for secondary text, labels, and descriptions.
- **Text Muted:** `#9CA3AF` — Used for section labels and placeholders.
- **Border Neutral:** `#E5E7EB` — Used for card borders, dividers, and list separators.
- **Background Page:** `#FAFBFB` — Base background for the Admin portal.
- **Background Light:** `#F3F4F6` — Base background for table hovers and text inputs.
- **Background White:** `#f9fafb` — Base background for sticky headers.

---

### Typography

#### Font Pairings
- **Headings & Logos:** `Space Grotesk` (weights: 400, 500, 600, 700) — Modern, tech-forward, and geometrically distinct.
- **Body & Numerical Data:** `Inter` (weights: 300, 400, 500, 600, 700) — High legibility for transactional tables, rates, and values.

#### Typography Scale
- **H1 (Large Titles):** `1.875rem` (`30px`) | Bold (700) | Line Height: `1.25`
- **H2 (Section Titles):** `1.25rem` (`20px`) | Bold (700) | Line Height: `1.3`
- **H3 (Card Headings):** `1.125rem` (`18px`) | Semi-Bold (600) | Line Height: `1.4`
- **Body (Standard):** `0.938rem` (`15px`) | Regular (400) or Medium (500) | Line Height: `1.5`
- **Small (Badges & Footnotes):** `0.75rem` (`12px`) | Semi-Bold (600) | Line Height: `1`

---

### Spacing & Layout Tokens
A strict 8px layout grid is used for spacing, defined by the following variables:
- **`--spacing-xs`:** `8px` — Used for inline gap structures, list items, and label padding.
- **`--spacing-sm`:** `12px` — Used for compact card padding and button details.
- **`--spacing-md`:** `16px` — Used for default card padding, flex gaps, and layout rows.
- **`--spacing-lg`:** `24px` — Used for large page section gaps, margins, and headers.
- **`--spacing-xl`:** `32px` — Used for page titles and login card structures.

---

### Borders & Radius Tokens
- **`--radius-sm`:** `8px` — Used for buttons, search inputs, and micro cards.
- **`--radius-md`:** `12px` — Used for content cards and grid elements.
- **`--radius-lg`:** `16px` — Used for primary page modules and dialog content.
- **`--radius-xl`:** `24px` — Used for desktop login wrappers and mobile modal sheets.
- **`--radius-full`:** `9999px` / `50px` — Used for status badges and pill indicators.

---

### Transitions & Motion
- **`--transition-base`:** `all 0.3s ease` — Used for standard button hovers and menu expands.
- **`--transition-slow`:** `all 0.4s ease` — Used for layout transitions, modals, and sidebar collapses.

#### Animations
1. **`shake`:** A subtle horizontal movement used on input fields to indicate validation errors.
2. **`ring`:** An oscillation animation used on warning icons or notifications to catch user attention.
3. **`scaleIn`:** A bounce entrance used on success badges to make transaction approvals feel rewarding.
4. **`shimmer`:** A sliding gradient swipe used on progress bars to represent loading states.
5. **`rotateBorderColors`:** A clockwise border-color rotation (`#10b981` to transparent) to display transaction processing.

---

## 3. UI Components & Patterns

### 1. Stat Cards
- **Structure:** White card backdrop, border `#E5E7EB`.
- **Left Slot:** Circular or rounded icon box (`32px` or `40px` size) with brand-specific background colors (`#03C9D7`, `#FB9678`, `#00C292`).
- **Right Slot:** Category label in small gray text, with a large bold value indicator (`1.875rem` font size).
- **Inline Trend:** Green or red percentage indicator containing a small `TrendingUp` or `TrendingDown` icon to indicate changes compared to previous cycles.

```
┌──────────────────────────────────────────────┐
│  ┌───┐  Dispositivos Activos                 │
│  │ 👤│  ────────────────────                 │
│  └───┘  124  [ ▲ 4.2% ]                      │
└──────────────────────────────────────────────┘
```

---

### 2. Status Badges
Status indicators must be pill-shaped, uppercase, and have solid colors that contrast cleanly against their background.
- **`APPROVED` / `PAID`:** Green badge (`#D1FAE5` bg, `#065F46` text)
- **`PENDING` / `CONFIRMING`:** Yellow badge (`#FEF3C7` bg, `#92400E` text)
- **`DECLINED` / `FAILED`:** Red badge (`#FEE2E2` bg, `#991B1B` text)

---

### 3. Buttons
- **Primary CTA Button:** Flat teal background (`#03C9D7`), semi-bold text, `0.5rem` radius. On hover, it shifts to `#0394A3`, lifts up `translateY(-1px)`, and displays a glowing shadow (`rgba(3, 201, 215, 0.3)`).
- **Mobile Floating Action Button (FAB):** Bottom-right position, circular (`3.5rem` diameter), color `#03C9D7` with deep shadow. Replaced on desktop by a standard button.
- **Processing State:** Disabled click events, opacity reduced to `0.6`, with a spinning border or animated border colors.

---

### 4. Forms & Inputs
- **Text Inputs:** Light gray background (`#F9FAFB`), border `#D1D5DB`, regular font size. When focused, the background becomes white, the border changes to teal (`#03C9D7`), and a glowing rings displays.
- **Keypad Style / Code Inputs:** Wide text inputs centering numbers, with larger font size (`24px`).
- **Nequi Phone Input Group:** A unified input containing a left gray country code flag (+57) and a large right text input for the cell phone number.

---

### 5. Modals & Bottom Sheets
- **Mobile Sheets:** Slides up from the bottom of the viewport, taking up full width with a top center rounded drag handle (`40px` wide, `#e5e7eb` color).
- **Desktop Modals:** Centers dynamically on the screen with a maximum width of `400px` and rounded corners on all sides (`--radius-xl`).
- **Overlay Backdrop:** Flat transparent black (`rgba(0, 0, 0, 0.6)`) with a backdrop blur filter for premium depth.

---

### 6. Toast Notifications
- **Position:** Top-center of the screen, floating above all other elements.
- **Style:** Small, thin bar with rounded corners, utilizing slide-in animations.
- **Coloring:** Solid red for warnings and solid emerald green for successes, featuring bold labels and clean descriptions.

---

## 4. Thematic Styles

### Glassmorphism (Customer Payment Screen Only)
The user-facing checkout screen uses a frosted glass effect to make the payment card feel floating and premium.
- **Backdrop Blur:** `backdrop-filter: blur(10px)`
- **Background Opacity:** `background: rgba(255, 255, 255, 0.15)`
- **Border Opacity:** `border: 1px solid rgba(255, 255, 255, 0.3)`
- **Floating Particles:** Tiny floating circles behind the card that drift across the screen to create depth.

---

## 5. Responsive Design Rules

### Breakpoints
- **Desktop & Tablets:** `min-width: 769px`
- **Mobile Devices:** `max-width: 768px`
- **Compact Handsets:** `max-width: 480px`

### Layout Conversions
1. **Sidebar Navigation:** On desktop, the sidebar is a fixed left panel (`280px` width) that can collapse into an icon bar (`80px`). On mobile, the sidebar collapses off-screen, replaced by a top `mobile-header` (`60px` height) with a hamburger toggle button that reveals the sidebar as an overlay.
2. **Dashboard Grid:** Stats cards display in a 4-column layout on desktop, converting to a 3-column layout on tablet, and collapsing to a 2-column or single-column layout on mobile.
3. **Stat Card Elements:** Circular icons on stat cards are visible on desktop but are hidden on mobile viewports (`max-width: 768px`) to maximize data space.
4. **Action Buttons:** Filters and export features collapse into sliding sheets or dropdown menus on mobile.
5. **Receipts & Summaries:** On mobile, table components collapse into compact detail rows or card lists.
