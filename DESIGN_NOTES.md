# BLE Buddy Design Notes

Tracking UI decisions that differ from defaults or main LLOGB app.

---

## Login Page

### Consistent Border Radius (8px / rounded-lg)
All elements use `rounded-lg` (8px) for visual consistency:
- Main card
- Banner image
- Input fields (SVG `radius = 8`)
- Login button
- Error message box

### Page Title ("LOWLIFE LOGIN")
- **3D text effect** with layered shadows:
  ```css
  text-shadow:
    0 1px 0 #ccc,
    0 2px 0 #bbb,
    0 3px 0 #999,
    0 4px 0 #888,
    0 5px 4px rgba(0,0,0,0.4),
    0 8px 12px rgba(0,0,0,0.3)
  ```

### Input Fields (Email & Password)
- **Height**: `h-12` (48px)
- **Floating label**: transparent background (no cutout needed with animated SVG border)

### Login Button
- **Padding**: `p-3`
- **Background**: `bg-purple-800` with `hover:bg-purple-900`
- **3D SVG version**: `public/icons/loginbutton.svg` (rx="8")

### Login Card
- **Scale cap**: 1.6x max
- **Layout**: 55% banner / 45% form split

### Footer
- **Spacing**: `mt-4` above footer
- **Z-index**: `z-20` to render above card glow
- **Social Icons**: External SVGs from `public/icons/` with 3D inner shadow effect baked in
  - Height: `22px` with auto width to preserve aspect ratio
  - Gap: `gap-4` between icons
  - Hover: `scale-110` transform
  - Icons have white fill with inner shadow filter for 3D appearance
  - Order: Twitch, Facebook, Messenger, Spotify, TikTok, Snapchat, Discord, Instagram, YouTube, Twitter
- **Links**: `text-sm` size (Terms, Privacy, Contact)
- **TODO (LLOGB)**: Add Twitter, Instagram, Messenger icons to main app footer + update order

---

## Color Palette

| Element | Color | Notes |
|---------|-------|-------|
| Button fill | `#5b21b6` | purple-800 |
| Card border | `#5b21b6` | purple-800 |
| Card glow | `rgba(168,85,247,0.4)` | #a855f7 / purple-500 |
| Hyperlinks | `#5b21b6` | purple-800 |
| Hyperlink hover | `#a855f7` | purple-500 (matches glow) |
| Input border (progress) | `#7c3aed` | purple-600 |

*Note: Bright purple glow (#a855f7) complements the pink/magenta tones in the banner image.*

---

## General UI Tokens

| Element | Radius |
|---------|--------|
| Form inputs | `rounded-lg` (8px) |
| Buttons (form) | `rounded-lg` (8px) |
| Cards/modals | `rounded-lg` (8px) |
| Dropdowns | `rounded-lg` (8px) |

*Note: Login page uses consistent 8px radius across all elements for visual harmony.*

---

## Beta vs Production

### During Beta
- [ ] Beta banner/badge visible in UI
- [ ] Debug logging enabled
- [ ] Test accounts allowed
- [ ] Waitlist link active on login page
- [ ] Error details shown to users (for bug reports)
- [ ] "No board" demo mode enabled (bypass BLE requirement)

### After Beta (Production)
- [ ] Remove beta banner/badge
- [ ] Disable verbose logging
- [ ] Remove test account access
- [ ] Replace waitlist link with signup/direct access
- [ ] Hide error details (show friendly messages only)
- [ ] Enable analytics/telemetry
- [ ] Update app store descriptions

### Files to Update
| File | Beta | Production |
|------|------|------------|
| `Login.tsx` | Waitlist link | Direct signup |
| `App.tsx` | Beta badge | Remove |
| `utils/` | Debug logs | Production logs |

---

*Last updated: December 12, 2025*
