
## Plan: Make Landing Hero Section Responsive and Full-Viewport

### Problem
The hero section on the landing page doesn't fill the full viewport on both mobile and desktop views. The "How it works" section partially appears in the initial viewport, cutting off the hero experience.

### Solution
Adjust the hero section to occupy the full viewport height (minus the navbar) on all screen sizes, ensuring users see the complete CTA before scrolling.

### Changes to `src/pages/Landing.tsx`

1. **Hero Section Height**
   - Add `min-h-[calc(100dvh-80px)]` to ensure the hero fills the viewport minus the navbar height
   - Use `100dvh` (dynamic viewport height) for better mobile support where browser chrome changes
   - Add `flex items-center` to vertically center content when viewport is larger than content

2. **Responsive Adjustments**
   - Reduce padding on mobile (`pt-20` instead of `pt-28`)
   - Adjust text sizes for smaller mobile screens (`text-4xl` base, `md:text-5xl`, `lg:text-6xl`)
   - Ensure buttons remain readable on small devices

### Technical Details
```tsx
// Before
<section className="overflow-hidden bg-gradient-to-br ... px-6 pb-12 pt-28 lg:pb-16 lg:pt-32">

// After  
<section className="min-h-[calc(100dvh-80px)] flex items-center overflow-hidden bg-gradient-to-br ... px-6 py-12 lg:py-16">
```

This ensures the hero section fills the viewport on all devices while maintaining proper spacing and allowing vertical centering of content.
