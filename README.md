# JigglyFonts 🌊

Render text as jiggly SVG with jelly-like wiggle animations. A fun React component that makes your text come alive!

## Installation

```bash
npm install jigglyfonts
# or
pnpm add jigglyfonts
# or
yarn add jigglyfonts
```

## Usage

```tsx
import { JigglyText } from 'jigglyfonts';

function App() {
  return (
    <JigglyText 
      text="Hello"
      fill="#ff6b6b"
      fontSize={72}
      intensity={1.5}
      speed={50}
      style={{ width: '400px', height: '100px' }}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | `"Hello"` | The text to render |
| `font` | `string` | `"Arial, sans-serif"` | Font family to use |
| `fontSize` | `number` | `72` | Font size in pixels |
| `fill` | `string` | `"#000000"` | Fill color of the text |
| `stroke` | `string` | `"none"` | Stroke color of the text |
| `strokeWidth` | `number` | `0` | Stroke width |
| `intensity` | `number` | `1.5` | Animation intensity (how much the text jiggles) |
| `speed` | `number` | `50` | Animation speed in milliseconds |
| `animated` | `boolean` | `true` | Whether animation is enabled |
| `className` | `string` | - | Additional className for the SVG |
| `style` | `CSSProperties` | - | Additional styles for the SVG |

## Examples

### Basic Usage

```tsx
<JigglyText text="Hello" />
```

### Custom Colors

```tsx
<JigglyText 
  text="Hello" 
  fill="#4ecdc4"
  stroke="#333"
  strokeWidth={2}
/>
```

### Slow Jiggle

```tsx
<JigglyText 
  text="Hello" 
  intensity={1}
  speed={150}
/>
```

### High Intensity

```tsx
<JigglyText 
  text="Hello" 
  intensity={3}
  speed={30}
/>
```

### Static (No Animation)

```tsx
<JigglyText 
  text="Hello" 
  animated={false}
/>
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build the library
pnpm build:lib
```

## License

MIT
