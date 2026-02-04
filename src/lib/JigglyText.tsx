import { useEffect, useRef, useState, useId, type FC, type CSSProperties } from 'react';

export interface GradientStop {
	/** Color at this stop */
	color: string;
	/** Position of stop (0-100) */
	offset: number;
}

export interface GradientConfig {
	/** Type of gradient */
	type?: 'linear' | 'radial';
	/** Angle for linear gradient (degrees) */
	angle?: number;
	/** Array of color stops */
	stops: GradientStop[];
}

export interface JigglyTextProps {
	/** The text to render */
	text?: string;
	/** Font family to use */
	font?: string;
	/** Font size in pixels */
	fontSize?: number;
	/** Fill color of the text */
	fill?: string;
	/** Gradient fill (overrides fill if provided) */
	gradient?: GradientConfig;
	/** Stroke color of the text */
	stroke?: string;
	/** Stroke width */
	strokeWidth?: number;
	/** Animation intensity (how much the text jiggles) */
	intensity?: number;
	/** Animation speed in milliseconds */
	speed?: number;
	/** Whether animation is enabled */
	animated?: boolean;
	/** Whether the text morphs when mouse is nearby */
	interactsWithMouse?: boolean;
	/** Radius of mouse interaction effect */
	mouseRadius?: number;
	/** Strength of mouse interaction effect */
	mouseStrength?: number;
	/** Wave mode - letters animate with sequential delay */
	waveMode?: boolean;
	/** Delay between each letter in wave mode (ms) */
	waveDelay?: number;
	/** Additional className for the SVG */
	className?: string;
	/** Additional styles for the SVG */
	style?: CSSProperties;
}

interface PathCommand {
	command: string;
	values: number[];
	originalValues: number[];
}

const parsePathData = (d: string): PathCommand[] => {
	const commands: PathCommand[] = [];
	const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;

	let match;
	while ((match = regex.exec(d)) !== null) {
		const [, command, valueStr] = match;
		const values = valueStr
			.trim()
			.split(/[\s,]+/)
			.filter((v) => v !== '')
			.map(Number)
			.filter((v) => !isNaN(v));

		commands.push({
			command,
			values: [...values],
			originalValues: [...values]
		});
	}

	return commands;
};

const commandsToPath = (commands: PathCommand[]): string => {
	return commands.map(({ command, values }) => `${command}${values.join(',')}`).join('');
};

const jiggleCommands = (commands: PathCommand[], intensity: number): PathCommand[] => {
	return commands.map((cmd) => {
		if (cmd.command === 'Z' || cmd.command === 'z') {
			return cmd;
		}

		const jiggled = cmd.originalValues.map((val) => {
			const offset = (Math.random() - 0.5) * 2 * intensity;
			return val + offset;
		});

		return {
			...cmd,
			values: jiggled
		};
	});
};

const morphCommandsWithMouse = (
	commands: PathCommand[],
	mouseX: number,
	mouseY: number,
	radius: number,
	strength: number
): PathCommand[] => {
	return commands.map((cmd) => {
		if (cmd.command === 'Z' || cmd.command === 'z') {
			return cmd;
		}

		// Use cmd.values (which may already be jiggled) instead of originalValues
		const morphed = cmd.values.map((val, idx) => {
			// Alternate between x and y coordinates
			const isX = idx % 2 === 0;
			const coordValue = val;
			const otherIdx = isX ? idx + 1 : idx - 1;
			const otherValue = cmd.values[otherIdx] ?? val;

			const pointX = isX ? coordValue : otherValue;
			const pointY = isX ? otherValue : coordValue;

			const dx = pointX - mouseX;
			const dy = pointY - mouseY;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance < radius && distance > 0) {
				const force = (1 - distance / radius) * strength;
				const pushX = (dx / distance) * force;
				const pushY = (dy / distance) * force;

				return val + (isX ? pushX : pushY);
			}

			return val;
		});

		return {
			...cmd,
			values: morphed
		};
	});
};

export const JigglyText: FC<JigglyTextProps> = ({
	text = '',
	font = 'Arial, sans-serif',
	fontSize = 72,
	fill = '#000000',
	gradient,
	stroke = 'none',
	strokeWidth = 0,
	intensity = 1.5,
	speed = 50,
	animated = true,
	interactsWithMouse = false,
	mouseRadius = 50,
	mouseStrength = 15,
	waveMode = false,
	waveDelay = 100,
	className,
	style
}) => {
	const gradientId = useId();
	const svgRef = useRef<SVGSVGElement>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [pathData, setPathData] = useState<string>('');
	const [viewBox, setViewBox] = useState<string>('0 0 100 100');
	const [svgDimensions, setSvgDimensions] = useState({ width: 100, height: 100 });
	const originalCommandsRef = useRef<PathCommand[]>([]);
	const letterCommandsRef = useRef<PathCommand[][]>([]);
	const animationFrameRef = useRef<number>();
	const lastUpdateRef = useRef<number>(0);
	const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
	const waveStartTimeRef = useRef<number>(0);

	// Extract path data from text using canvas
	useEffect(() => {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.font = `${fontSize}px ${font}`;
		const metrics = ctx.measureText(text);

		const width = Math.ceil(metrics.width) + 20;
		const height = fontSize + 20;

		canvas.width = width;
		canvas.height = height;

		ctx.font = `${fontSize}px ${font}`;
		ctx.textBaseline = 'top';

		// Generate per-letter paths for wave mode
		const { fullPath, perLetterPaths } = textToPathWithLetters(text, font, fontSize, 10, fontSize);

		originalCommandsRef.current = parsePathData(fullPath);
		letterCommandsRef.current = perLetterPaths.map((p) => parsePathData(p));
		setPathData(fullPath);
		setViewBox(`0 0 ${width} ${height}`);
		setSvgDimensions({ width, height });
		waveStartTimeRef.current = performance.now();

		canvasRef.current = canvas;
	}, [text, font, fontSize]);

	// Animation loop
	useEffect(() => {
		if ((!animated && !interactsWithMouse) || originalCommandsRef.current.length === 0) return;

		const animate = (timestamp: number) => {
			if (timestamp - lastUpdateRef.current >= speed) {
				if (waveMode && letterCommandsRef.current.length > 0) {
					// Wave mode: animate each letter with a phase offset
					const elapsed = timestamp - waveStartTimeRef.current;
					const newLetterPaths = letterCommandsRef.current.map((letterCmds, index) => {
						// Calculate wave phase for this letter
						const letterPhase = index * waveDelay;
						const waveIntensity = Math.sin(((elapsed - letterPhase) / 200) * Math.PI) * 0.5 + 0.5;
						const currentIntensity = intensity * waveIntensity;

						let commands = letterCmds.map((cmd) => ({
							...cmd,
							values: [...cmd.originalValues],
							originalValues: [...cmd.originalValues]
						}));

						// Apply jiggle with wave-modulated intensity
						if (animated) {
							commands = jiggleCommands(commands, currentIntensity);
						}

						// Apply mouse morphing if enabled
						if (interactsWithMouse && mousePositionRef.current) {
							commands = morphCommandsWithMouse(
								commands,
								mousePositionRef.current.x,
								mousePositionRef.current.y,
								mouseRadius,
								mouseStrength
							);
						}

						return commandsToPath(commands);
					});

					setPathData(newLetterPaths.join(''));
				} else {
					// Normal mode: animate all letters together
					let commands = originalCommandsRef.current;

					// Apply jiggle if animated
					if (animated) {
						commands = jiggleCommands(commands, intensity);
					}

					// Apply mouse morphing if enabled and mouse is in range
					if (interactsWithMouse && mousePositionRef.current) {
						commands = morphCommandsWithMouse(
							commands,
							mousePositionRef.current.x,
							mousePositionRef.current.y,
							mouseRadius,
							mouseStrength
						);
					}

					setPathData(commandsToPath(commands));
				}

				lastUpdateRef.current = timestamp;
			}
			animationFrameRef.current = requestAnimationFrame(animate);
		};

		animationFrameRef.current = requestAnimationFrame(animate);

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [animated, intensity, speed, interactsWithMouse, mouseRadius, mouseStrength, waveMode, waveDelay]);

	// Mouse interaction handler
	const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
		if (!interactsWithMouse || !svgRef.current) return;

		const svg = svgRef.current;
		const rect = svg.getBoundingClientRect();
		const scaleX = svgDimensions.width / rect.width;
		const scaleY = svgDimensions.height / rect.height;

		mousePositionRef.current = {
			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY
		};
	};

	const handleMouseLeave = () => {
		mousePositionRef.current = null;
	};

	return (
		<svg
			ref={svgRef}
			viewBox={viewBox}
			className={className}
			style={{
				display: 'inline-block',
				...style
			}}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
		>
			{gradient && (
				<defs>
					{gradient.type === 'radial' ? (
						<radialGradient id={gradientId}>
							{gradient.stops.map((stop, i) => (
								<stop key={i} offset={`${stop.offset}%`} stopColor={stop.color} />
							))}
						</radialGradient>
					) : (
						<linearGradient
							id={gradientId}
							x1='0%'
							y1='0%'
							x2={`${Math.cos((((gradient.angle ?? 0) - 90) * Math.PI) / 180) * 50 + 50}%`}
							y2={`${Math.sin((((gradient.angle ?? 0) - 90) * Math.PI) / 180) * 50 + 50}%`}
						>
							{gradient.stops.map((stop, i) => (
								<stop key={i} offset={`${stop.offset}%`} stopColor={stop.color} />
							))}
						</linearGradient>
					)}
				</defs>
			)}
			<path
				d={pathData}
				fill={gradient ? `url(#${gradientId})` : fill}
				stroke={stroke}
				strokeWidth={strokeWidth}
				style={{
					transition: animated ? `d ${speed / 2}ms ease-out` : undefined
				}}
			/>
			{/* Invisible selectable text overlay */}
			<text
				x='10'
				y={fontSize}
				fontFamily={font}
				fontSize={fontSize}
				fill='transparent'
				style={{
					userSelect: 'text',
					cursor: 'text'
				}}
			>
				{text}
			</text>
		</svg>
	);
};

// Generate approximate path data for text with per-letter paths
// This creates a hand-drawn style path for each character
function textToPathWithLetters(
	text: string,
	font: string,
	fontSize: number,
	startX: number,
	startY: number
): { fullPath: string; perLetterPaths: string[] } {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return { fullPath: '', perLetterPaths: [] };

	ctx.font = `${fontSize}px ${font}`;

	const perLetterPaths: string[] = [];
	let currentX = startX;

	for (const char of text) {
		const charWidth = ctx.measureText(char).width;
		const charPath = characterToPath(char, currentX, startY, charWidth, fontSize);
		perLetterPaths.push(charPath);
		currentX += charWidth;
	}

	return {
		fullPath: perLetterPaths.join(''),
		perLetterPaths
	};
}

// Generate path for individual character using geometric approximation
function characterToPath(char: string, x: number, y: number, width: number, height: number): string {
	// This creates simplified geometric paths for letters
	// For production, you'd want to use a font parsing library like opentype.js

	const s = width * 0.15; // stroke width

	const paths: Record<string, (x: number, y: number, w: number, h: number) => string> = {
		// Uppercase letters
		A: (x, y, w, h) => {
			const peak = y - h;
			const mid = y - h * 0.4;
			return `M${x},${y} L${x + w * 0.5},${peak} L${x + w},${y} L${x + w - s},${y} L${x + w * 0.5},${peak + s * 2} L${x + s},${y} Z M${x + w * 0.25},${mid} L${x + w * 0.75},${mid} L${x + w * 0.7},${mid + s} L${x + w * 0.3},${mid + s} Z`;
		},
		B: (x, y, w, h) => {
			const top = y - h;
			const mid = y - h * 0.5;
			return `M${x},${top} L${x + w * 0.7},${top} Q${x + w},${top} ${x + w},${top + h * 0.25} Q${x + w},${mid} ${x + w * 0.6},${mid} Q${x + w},${mid} ${x + w},${y - h * 0.25} Q${x + w},${y} ${x + w * 0.7},${y} L${x},${y} Z M${x + s},${top + s} L${x + s},${mid - s * 0.5} L${x + w * 0.6},${mid - s * 0.5} Q${x + w - s},${mid - s * 0.5} ${x + w - s},${top + h * 0.25} Q${x + w - s},${top + s} ${x + w * 0.6},${top + s} Z M${x + s},${mid + s * 0.5} L${x + s},${y - s} L${x + w * 0.65},${y - s} Q${x + w - s},${y - s} ${x + w - s},${y - h * 0.25} Q${x + w - s},${mid + s * 0.5} ${x + w * 0.55},${mid + s * 0.5} Z`;
		},
		C: (x, y, w, h) => {
			const cx = x + w * 0.55;
			const cy = y - h * 0.5;
			return `M${x + w},${y - h * 0.2} Q${x + w},${y} ${cx},${y} Q${x},${y} ${x},${cy} Q${x},${y - h} ${cx},${y - h} Q${x + w},${y - h} ${x + w},${y - h * 0.8} L${x + w - s},${y - h * 0.8} Q${x + w - s},${y - h + s} ${cx},${y - h + s} Q${x + s},${y - h + s} ${x + s},${cy} Q${x + s},${y - s} ${cx},${y - s} Q${x + w - s},${y - s} ${x + w - s},${y - h * 0.2} Z`;
		},
		D: (x, y, w, h) => {
			const top = y - h;
			return `M${x},${top} L${x + w * 0.6},${top} Q${x + w},${top} ${x + w},${y - h * 0.5} Q${x + w},${y} ${x + w * 0.6},${y} L${x},${y} Z M${x + s},${top + s} L${x + s},${y - s} L${x + w * 0.55},${y - s} Q${x + w - s},${y - s} ${x + w - s},${y - h * 0.5} Q${x + w - s},${top + s} ${x + w * 0.55},${top + s} Z`;
		},
		E: (x, y, w, h) => {
			const top = y - h;
			const mid = y - h * 0.5;
			return `M${x},${top} L${x + w},${top} L${x + w},${top + s} L${x + s},${top + s} L${x + s},${mid - s * 0.5} L${x + w * 0.8},${mid - s * 0.5} L${x + w * 0.8},${mid + s * 0.5} L${x + s},${mid + s * 0.5} L${x + s},${y - s} L${x + w},${y - s} L${x + w},${y} L${x},${y} Z`;
		},
		F: (x, y, w, h) => {
			const top = y - h;
			const mid = y - h * 0.5;
			return `M${x},${top} L${x + w},${top} L${x + w},${top + s} L${x + s},${top + s} L${x + s},${mid - s * 0.5} L${x + w * 0.8},${mid - s * 0.5} L${x + w * 0.8},${mid + s * 0.5} L${x + s},${mid + s * 0.5} L${x + s},${y} L${x},${y} Z`;
		},
		G: (x, y, w, h) => {
			const cx = x + w * 0.55;
			const cy = y - h * 0.5;
			const mid = y - h * 0.45;
			return `M${x + w},${y - h * 0.2} Q${x + w},${y} ${cx},${y} Q${x},${y} ${x},${cy} Q${x},${y - h} ${cx},${y - h} Q${x + w},${y - h} ${x + w},${y - h * 0.8} L${x + w - s},${y - h * 0.8} Q${x + w - s},${y - h + s} ${cx},${y - h + s} Q${x + s},${y - h + s} ${x + s},${cy} Q${x + s},${y - s} ${cx},${y - s} Q${x + w - s},${y - s} ${x + w - s},${mid + s} L${x + w * 0.5},${mid + s} L${x + w * 0.5},${mid} L${x + w},${mid} Z`;
		},
		H: (x, y, w, h) => {
			const top = y - h;
			const mid = y - h * 0.5;
			return `M${x},${top} L${x + s},${top} L${x + s},${mid - s * 0.5} L${x + w - s},${mid - s * 0.5} L${x + w - s},${top} L${x + w},${top} L${x + w},${y} L${x + w - s},${y} L${x + w - s},${mid + s * 0.5} L${x + s},${mid + s * 0.5} L${x + s},${y} L${x},${y} Z`;
		},
		I: (x, y, w, h) => {
			const top = y - h;
			const cx = x + w * 0.5;
			const sw = w * 0.2;
			return `M${x},${top} L${x + w},${top} L${x + w},${top + s} L${cx + sw},${top + s} L${cx + sw},${y - s} L${x + w},${y - s} L${x + w},${y} L${x},${y} L${x},${y - s} L${cx - sw},${y - s} L${cx - sw},${top + s} L${x},${top + s} Z`;
		},
		J: (x, y, w, h) => {
			const top = y - h;
			return `M${x + w * 0.3},${top} L${x + w},${top} L${x + w},${y - h * 0.3} Q${x + w},${y} ${x + w * 0.5},${y} Q${x},${y} ${x},${y - h * 0.3} L${x + s},${y - h * 0.3} Q${x + s},${y - s} ${x + w * 0.5},${y - s} Q${x + w - s},${y - s} ${x + w - s},${y - h * 0.3} L${x + w - s},${top + s} L${x + w * 0.3},${top + s} Z`;
		},
		K: (x, y, w, h) => {
			const top = y - h;
			const mid = y - h * 0.5;
			return `M${x},${top} L${x + s},${top} L${x + s},${mid - s} L${x + w - s},${top} L${x + w},${top} L${x + s * 2},${mid} L${x + w},${y} L${x + w - s},${y} L${x + s},${mid + s} L${x + s},${y} L${x},${y} Z`;
		},
		L: (x, y, w, h) => {
			const top = y - h;
			return `M${x},${top} L${x + s},${top} L${x + s},${y - s} L${x + w},${y - s} L${x + w},${y} L${x},${y} Z`;
		},
		M: (x, y, w, h) => {
			const top = y - h;
			const cx = x + w * 0.5;
			return `M${x},${top} L${x + s},${top} L${cx},${y - h * 0.4} L${x + w - s},${top} L${x + w},${top} L${x + w},${y} L${x + w - s},${y} L${x + w - s},${top + s * 3} L${cx},${y - h * 0.3} L${x + s},${top + s * 3} L${x + s},${y} L${x},${y} Z`;
		},
		N: (x, y, w, h) => {
			const top = y - h;
			return `M${x},${top} L${x + s},${top} L${x + w - s},${y - s * 3} L${x + w - s},${top} L${x + w},${top} L${x + w},${y} L${x + w - s},${y} L${x + s},${top + s * 3} L${x + s},${y} L${x},${y} Z`;
		},
		O: (x, y, w, h) => {
			const cx = x + w * 0.5;
			const cy = y - h * 0.5;
			const rx = w * 0.5;
			const ry = h * 0.5;
			const irx = rx - s;
			const iry = ry - s;
			return `M${cx - rx},${cy} Q${cx - rx},${cy - ry} ${cx},${cy - ry} Q${cx + rx},${cy - ry} ${cx + rx},${cy} Q${cx + rx},${cy + ry} ${cx},${cy + ry} Q${cx - rx},${cy + ry} ${cx - rx},${cy} Z M${cx - irx},${cy} Q${cx - irx},${cy + iry} ${cx},${cy + iry} Q${cx + irx},${cy + iry} ${cx + irx},${cy} Q${cx + irx},${cy - iry} ${cx},${cy - iry} Q${cx - irx},${cy - iry} ${cx - irx},${cy} Z`;
		},
		P: (x, y, w, h) => {
			const top = y - h;
			const mid = y - h * 0.45;
			return `M${x},${top} L${x + w * 0.7},${top} Q${x + w},${top} ${x + w},${top + h * 0.275} Q${x + w},${mid} ${x + w * 0.7},${mid} L${x + s},${mid} L${x + s},${y} L${x},${y} Z M${x + s},${top + s} L${x + s},${mid - s} L${x + w * 0.65},${mid - s} Q${x + w - s},${mid - s} ${x + w - s},${top + h * 0.275} Q${x + w - s},${top + s} ${x + w * 0.65},${top + s} Z`;
		},
		Q: (x, y, w, h) => {
			const cx = x + w * 0.5;
			const cy = y - h * 0.5;
			const rx = w * 0.5;
			const ry = h * 0.5;
			const irx = rx - s;
			const iry = ry - s;
			return `M${cx - rx},${cy} Q${cx - rx},${cy - ry} ${cx},${cy - ry} Q${cx + rx},${cy - ry} ${cx + rx},${cy} Q${cx + rx},${cy + ry} ${cx},${cy + ry} Q${cx - rx},${cy + ry} ${cx - rx},${cy} Z M${cx - irx},${cy} Q${cx - irx},${cy + iry} ${cx},${cy + iry} Q${cx + irx},${cy + iry} ${cx + irx},${cy} Q${cx + irx},${cy - iry} ${cx},${cy - iry} Q${cx - irx},${cy - iry} ${cx - irx},${cy} Z M${cx + w * 0.1},${y - h * 0.3} L${x + w},${y} L${x + w - s},${y} L${cx},${y - h * 0.25} Z`;
		},
		R: (x, y, w, h) => {
			const top = y - h;
			const mid = y - h * 0.45;
			return `M${x},${top} L${x + w * 0.7},${top} Q${x + w},${top} ${x + w},${top + h * 0.275} Q${x + w},${mid} ${x + w * 0.7},${mid} L${x + w * 0.5},${mid} L${x + w},${y} L${x + w - s},${y} L${x + w * 0.45},${mid} L${x + s},${mid} L${x + s},${y} L${x},${y} Z M${x + s},${top + s} L${x + s},${mid - s} L${x + w * 0.65},${mid - s} Q${x + w - s},${mid - s} ${x + w - s},${top + h * 0.275} Q${x + w - s},${top + s} ${x + w * 0.65},${top + s} Z`;
		},
		S: (x, y, w, h) => {
			const top = y - h;
			const mid = y - h * 0.5;
			return `M${x + w},${top + h * 0.2} Q${x + w},${top} ${x + w * 0.5},${top} Q${x},${top} ${x},${top + h * 0.25} Q${x},${mid} ${x + w * 0.5},${mid} Q${x + w - s},${mid} ${x + w - s},${y - h * 0.25} Q${x + w - s},${y - s} ${x + w * 0.5},${y - s} Q${x + s},${y - s} ${x + s},${y - h * 0.2} L${x},${y - h * 0.2} Q${x},${y} ${x + w * 0.5},${y} Q${x + w},${y} ${x + w},${y - h * 0.25} Q${x + w},${mid} ${x + w * 0.5},${mid} Q${x + s},${mid} ${x + s},${top + h * 0.25} Q${x + s},${top + s} ${x + w * 0.5},${top + s} Q${x + w - s},${top + s} ${x + w - s},${top + h * 0.2} Z`;
		},
		T: (x, y, w, h) => {
			const top = y - h;
			const cx = x + w * 0.5;
			return `M${x},${top} L${x + w},${top} L${x + w},${top + s} L${cx + s * 0.5},${top + s} L${cx + s * 0.5},${y} L${cx - s * 0.5},${y} L${cx - s * 0.5},${top + s} L${x},${top + s} Z`;
		},
		U: (x, y, w, h) => {
			const top = y - h;
			const cx = x + w * 0.5;
			return `M${x},${top} L${x + s},${top} L${x + s},${y - h * 0.35} Q${x + s},${y - s} ${cx},${y - s} Q${x + w - s},${y - s} ${x + w - s},${y - h * 0.35} L${x + w - s},${top} L${x + w},${top} L${x + w},${y - h * 0.35} Q${x + w},${y} ${cx},${y} Q${x},${y} ${x},${y - h * 0.35} Z`;
		},
		V: (x, y, w, h) => {
			const top = y - h;
			const cx = x + w * 0.5;
			return `M${x},${top} L${x + s},${top} L${cx},${y - s} L${x + w - s},${top} L${x + w},${top} L${cx + s * 0.5},${y} L${cx - s * 0.5},${y} Z`;
		},
		W: (x, y, w, h) => {
			const top = y - h;
			return `M${x},${top} L${x + s},${top} L${x + w * 0.25},${y - s} L${x + w * 0.5},${top + s * 2} L${x + w * 0.75},${y - s} L${x + w - s},${top} L${x + w},${top} L${x + w * 0.8},${y} L${x + w * 0.7},${y} L${x + w * 0.5},${top + s * 4} L${x + w * 0.3},${y} L${x + w * 0.2},${y} Z`;
		},
		X: (x, y, w, h) => {
			const top = y - h;
			const cx = x + w * 0.5;
			const cy = y - h * 0.5;
			return `M${x},${top} L${x + s},${top} L${cx},${cy - s * 0.5} L${x + w - s},${top} L${x + w},${top} L${cx + s * 0.7},${cy} L${x + w},${y} L${x + w - s},${y} L${cx},${cy + s * 0.5} L${x + s},${y} L${x},${y} L${cx - s * 0.7},${cy} Z`;
		},
		Y: (x, y, w, h) => {
			const top = y - h;
			const cx = x + w * 0.5;
			const mid = y - h * 0.45;
			return `M${x},${top} L${x + s},${top} L${cx},${mid} L${x + w - s},${top} L${x + w},${top} L${cx + s * 0.5},${mid + s} L${cx + s * 0.5},${y} L${cx - s * 0.5},${y} L${cx - s * 0.5},${mid + s} Z`;
		},
		Z: (x, y, w, h) => {
			const top = y - h;
			return `M${x},${top} L${x + w},${top} L${x + w},${top + s} L${x + s * 2},${y - s} L${x + w},${y - s} L${x + w},${y} L${x},${y} L${x},${y - s} L${x + w - s * 2},${top + s} L${x},${top + s} Z`;
		},

		// Lowercase letters
		a: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.45;
			return `M${x + w - s},${top} L${x + w},${top} L${x + w},${y} L${x + w - s},${y} L${x + w - s},${y - s} Q${x + w * 0.5},${y + s * 0.5} ${cx},${y} Q${x},${y} ${x},${y - hh * 0.5} Q${x},${top} ${cx},${top} Q${x + w - s},${top} ${x + w - s},${y - hh * 0.5} Z M${x + w - s},${y - hh * 0.5} Q${x + w - s},${top + s} ${cx},${top + s} Q${x + s},${top + s} ${x + s},${y - hh * 0.5} Q${x + s},${y - s} ${cx},${y - s} Q${x + w - s},${y - s} ${x + w - s},${y - hh * 0.5} Z`;
		},
		b: (x, y, w, h) => {
			const top = y - h;
			const lowTop = y - h * 0.7;
			const cx = x + w * 0.55;
			return `M${x},${top} L${x + s},${top} L${x + s},${lowTop + s} Q${x + w * 0.5},${lowTop - s * 0.5} ${cx},${lowTop} Q${x + w},${lowTop} ${x + w},${y - h * 0.35} Q${x + w},${y} ${cx},${y} Q${x + s},${y} ${x + s},${y} L${x + s},${y} L${x},${y} Z M${x + s},${y - h * 0.35} Q${x + s},${y - s} ${cx},${y - s} Q${x + w - s},${y - s} ${x + w - s},${y - h * 0.35} Q${x + w - s},${lowTop + s} ${cx},${lowTop + s} Q${x + s},${lowTop + s} ${x + s},${y - h * 0.35} Z`;
		},
		c: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.55;
			const cy = y - hh * 0.5;
			return `M${x + w},${top + hh * 0.2} Q${x + w},${top} ${cx},${top} Q${x},${top} ${x},${cy} Q${x},${y} ${cx},${y} Q${x + w},${y} ${x + w},${y - hh * 0.2} L${x + w - s},${y - hh * 0.2} Q${x + w - s},${y - s} ${cx},${y - s} Q${x + s},${y - s} ${x + s},${cy} Q${x + s},${top + s} ${cx},${top + s} Q${x + w - s},${top + s} ${x + w - s},${top + hh * 0.2} Z`;
		},
		d: (x, y, w, h) => {
			const top = y - h;
			const lowTop = y - h * 0.7;
			const cx = x + w * 0.45;
			return `M${x + w - s},${top} L${x + w},${top} L${x + w},${y} L${x + w - s},${y} L${x + w - s},${y - s} Q${x + w * 0.5},${y + s * 0.5} ${cx},${y} Q${x},${y} ${x},${y - h * 0.35} Q${x},${lowTop} ${cx},${lowTop} Q${x + w - s},${lowTop} ${x + w - s},${lowTop + s} Z M${x + w - s},${y - h * 0.35} Q${x + w - s},${lowTop + s} ${cx},${lowTop + s} Q${x + s},${lowTop + s} ${x + s},${y - h * 0.35} Q${x + s},${y - s} ${cx},${y - s} Q${x + w - s},${y - s} ${x + w - s},${y - h * 0.35} Z`;
		},
		e: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.5;
			const cy = y - hh * 0.5;
			const barY = cy;
			// Outer bowl from bar level up and around
			// Start at right side at bar level, go up around the top, down the left, across to form bar
			const outerPath = `M${x + w},${barY} Q${x + w},${top} ${cx},${top} Q${x},${top} ${x},${cy} Q${x},${y} ${cx},${y} Q${x + w * 0.8},${y} ${x + w},${y - hh * 0.25} L${x + w - s},${y - hh * 0.3} Q${x + w * 0.75},${y - s} ${cx},${y - s} Q${x + s},${y - s} ${x + s},${cy} Q${x + s},${top + s} ${cx},${top + s} Q${x + w - s},${top + s} ${x + w - s},${barY} L${x + w - s},${barY + s} L${x + s},${barY + s} L${x + s},${barY} Z`;
			return outerPath;
		},
		f: (x, y, w, h) => {
			const top = y - h;
			const mid = y - h * 0.65;
			const cx = x + w * 0.5;
			return `M${x + w},${top + h * 0.15} Q${x + w},${top} ${cx + w * 0.1},${top} Q${cx - w * 0.2},${top} ${cx - w * 0.2},${top + h * 0.2} L${cx - w * 0.2},${mid - s * 0.5} L${x},${mid - s * 0.5} L${x},${mid + s * 0.5} L${cx - w * 0.2},${mid + s * 0.5} L${cx - w * 0.2},${y} L${cx + w * 0.2},${y} L${cx + w * 0.2},${mid + s * 0.5} L${x + w * 0.8},${mid + s * 0.5} L${x + w * 0.8},${mid - s * 0.5} L${cx + w * 0.2},${mid - s * 0.5} L${cx + w * 0.2},${top + h * 0.2} Q${cx + w * 0.2},${top + s} ${cx + w * 0.1},${top + s} Q${x + w - s},${top + s} ${x + w - s},${top + h * 0.15} Z`;
		},
		g: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.5;
			const cy = y - hh * 0.5;
			const bottom = y + h * 0.25;
			return `M${x + w - s},${top} L${x + w},${top} L${x + w},${bottom - h * 0.1} Q${x + w},${bottom} ${cx},${bottom} Q${x},${bottom} ${x},${bottom - h * 0.1} L${x + s},${bottom - h * 0.1} Q${x + s},${bottom - s} ${cx},${bottom - s} Q${x + w - s},${bottom - s} ${x + w - s},${bottom - h * 0.1} L${x + w - s},${y + s} Q${x + w * 0.6},${y + s * 0.5} ${cx},${y} Q${x},${y} ${x},${cy} Q${x},${top} ${cx},${top} Q${x + w - s},${top} ${x + w - s},${cy} Z M${x + w - s},${cy} Q${x + w - s},${top + s} ${cx},${top + s} Q${x + s},${top + s} ${x + s},${cy} Q${x + s},${y - s} ${cx},${y - s} Q${x + w - s},${y - s} ${x + w - s},${cy} Z`;
		},
		h: (x, y, w, h) => {
			const top = y - h;
			const lowTop = y - h * 0.7;
			const cx = x + w * 0.6;
			return `M${x},${top} L${x + s},${top} L${x + s},${lowTop + s} Q${x + w * 0.4},${lowTop - s * 0.3} ${cx},${lowTop} Q${x + w},${lowTop} ${x + w},${lowTop + h * 0.2} L${x + w},${y} L${x + w - s},${y} L${x + w - s},${lowTop + h * 0.2} Q${x + w - s},${lowTop + s} ${cx},${lowTop + s} Q${x + s},${lowTop + s} ${x + s},${lowTop + h * 0.2} L${x + s},${y} L${x},${y} Z`;
		},
		i: (x, y, w, h) => {
			const top = y - h * 0.7;
			const cx = x + w * 0.5;
			const dotY = y - h * 0.85;
			const dotR = s * 0.9;
			const stemW = s * 0.9;
			return `M${cx - stemW},${top} L${cx + stemW},${top} L${cx + stemW},${y} L${cx - stemW},${y} Z M${cx},${dotY - dotR} Q${cx + dotR},${dotY - dotR} ${cx + dotR},${dotY} Q${cx + dotR},${dotY + dotR} ${cx},${dotY + dotR} Q${cx - dotR},${dotY + dotR} ${cx - dotR},${dotY} Q${cx - dotR},${dotY - dotR} ${cx},${dotY - dotR} Z`;
		},
		j: (x, y, w, h) => {
			const top = y - h * 0.7;
			const cx = x + w * 0.6;
			const dotY = y - h * 0.85;
			const dotR = s * 0.9;
			const bottom = y + h * 0.2;
			const stemW = s * 0.9;
			return `M${cx - stemW},${top} L${cx + stemW},${top} L${cx + stemW},${bottom - h * 0.1} Q${cx + stemW},${bottom} ${x + w * 0.3},${bottom} Q${x},${bottom} ${x},${bottom - h * 0.1} L${x + s},${bottom - h * 0.1} Q${x + s},${bottom - s} ${x + w * 0.3},${bottom - s} Q${cx - stemW},${bottom - s} ${cx - stemW},${bottom - h * 0.1} Z M${cx},${dotY - dotR} Q${cx + dotR},${dotY - dotR} ${cx + dotR},${dotY} Q${cx + dotR},${dotY + dotR} ${cx},${dotY + dotR} Q${cx - dotR},${dotY + dotR} ${cx - dotR},${dotY} Q${cx - dotR},${dotY - dotR} ${cx},${dotY - dotR} Z`;
		},
		k: (x, y, w, h) => {
			const top = y - h;
			const lowTop = y - h * 0.7;
			const mid = y - h * 0.35;
			return `M${x},${top} L${x + s},${top} L${x + s},${mid - s} L${x + w - s},${lowTop} L${x + w},${lowTop} L${x + s * 1.5},${mid} L${x + w},${y} L${x + w - s},${y} L${x + s},${mid + s} L${x + s},${y} L${x},${y} Z`;
		},
		l: (x, y, w, h) => {
			const top = y - h;
			const cx = x + w * 0.5;
			const stemW = s * 0.9;
			return `M${cx - stemW},${top} L${cx + stemW},${top} L${cx + stemW},${y} L${cx - stemW},${y} Z`;
		},
		m: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			return `M${x},${top} L${x + s},${top} L${x + s},${top + s} Q${x + w * 0.2},${top - s * 0.3} ${x + w * 0.3},${top} Q${x + w * 0.45},${top} ${x + w * 0.45},${top + hh * 0.25} L${x + w * 0.45},${top + s} Q${x + w * 0.55},${top - s * 0.3} ${x + w * 0.65},${top} Q${x + w},${top} ${x + w},${top + hh * 0.25} L${x + w},${y} L${x + w - s},${y} L${x + w - s},${top + hh * 0.25} Q${x + w - s},${top + s} ${x + w * 0.65},${top + s} Q${x + w * 0.55},${top + s} ${x + w * 0.55},${top + hh * 0.25} L${x + w * 0.55},${y} L${x + w * 0.45},${y} L${x + w * 0.45},${top + hh * 0.25} Q${x + w * 0.45},${top + s} ${x + w * 0.3},${top + s} Q${x + s},${top + s} ${x + s},${top + hh * 0.25} L${x + s},${y} L${x},${y} Z`;
		},
		n: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.6;
			return `M${x},${top} L${x + s},${top} L${x + s},${top + s} Q${x + w * 0.4},${top - s * 0.3} ${cx},${top} Q${x + w},${top} ${x + w},${top + hh * 0.3} L${x + w},${y} L${x + w - s},${y} L${x + w - s},${top + hh * 0.3} Q${x + w - s},${top + s} ${cx},${top + s} Q${x + s},${top + s} ${x + s},${top + hh * 0.3} L${x + s},${y} L${x},${y} Z`;
		},
		o: (x, y, w, h) => {
			const hh = h * 0.7;
			const cx = x + w * 0.5;
			const cy = y - hh * 0.5;
			const rx = w * 0.5;
			const ry = hh * 0.5;
			const irx = rx - s;
			const iry = ry - s * 0.8;
			return `M${cx - rx},${cy} Q${cx - rx},${cy - ry} ${cx},${cy - ry} Q${cx + rx},${cy - ry} ${cx + rx},${cy} Q${cx + rx},${cy + ry} ${cx},${cy + ry} Q${cx - rx},${cy + ry} ${cx - rx},${cy} Z M${cx - irx},${cy} Q${cx - irx},${cy + iry} ${cx},${cy + iry} Q${cx + irx},${cy + iry} ${cx + irx},${cy} Q${cx + irx},${cy - iry} ${cx},${cy - iry} Q${cx - irx},${cy - iry} ${cx - irx},${cy} Z`;
		},
		p: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.55;
			const cy = y - hh * 0.5;
			const bottom = y + h * 0.25;
			return `M${x},${top} L${x + s},${top} L${x + s},${top + s} Q${x + w * 0.4},${top - s * 0.3} ${cx},${top} Q${x + w},${top} ${x + w},${cy} Q${x + w},${y} ${cx},${y} Q${x + s},${y} ${x + s},${y} L${x + s},${bottom} L${x},${bottom} Z M${x + s},${cy} Q${x + s},${y - s} ${cx},${y - s} Q${x + w - s},${y - s} ${x + w - s},${cy} Q${x + w - s},${top + s} ${cx},${top + s} Q${x + s},${top + s} ${x + s},${cy} Z`;
		},
		q: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.45;
			const cy = y - hh * 0.5;
			const bottom = y + h * 0.25;
			return `M${x + w - s},${top} L${x + w},${top} L${x + w},${bottom} L${x + w - s},${bottom} L${x + w - s},${y - s} Q${x + w * 0.6},${y + s * 0.3} ${cx},${y} Q${x},${y} ${x},${cy} Q${x},${top} ${cx},${top} Q${x + w - s},${top} ${x + w - s},${top + s} Z M${x + w - s},${cy} Q${x + w - s},${top + s} ${cx},${top + s} Q${x + s},${top + s} ${x + s},${cy} Q${x + s},${y - s} ${cx},${y - s} Q${x + w - s},${y - s} ${x + w - s},${cy} Z`;
		},
		r: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			return `M${x},${top} L${x + s},${top} L${x + s},${top + s} Q${x + w * 0.4},${top - s * 0.3} ${x + w * 0.6},${top} Q${x + w},${top} ${x + w},${top + hh * 0.2} L${x + w - s},${top + hh * 0.2} Q${x + w - s},${top + s} ${x + w * 0.6},${top + s} Q${x + s},${top + s} ${x + s},${top + hh * 0.25} L${x + s},${y} L${x},${y} Z`;
		},
		s: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const mid = y - hh * 0.5;
			const cx = x + w * 0.5;
			return `M${x + w},${top + hh * 0.15} Q${x + w},${top} ${cx},${top} Q${x},${top} ${x},${top + hh * 0.25} Q${x},${mid} ${cx},${mid} Q${x + w - s},${mid} ${x + w - s},${y - hh * 0.25} Q${x + w - s},${y - s} ${cx},${y - s} Q${x + s},${y - s} ${x + s},${y - hh * 0.15} L${x},${y - hh * 0.15} Q${x},${y} ${cx},${y} Q${x + w},${y} ${x + w},${y - hh * 0.25} Q${x + w},${mid} ${cx},${mid} Q${x + s},${mid} ${x + s},${top + hh * 0.25} Q${x + s},${top + s} ${cx},${top + s} Q${x + w - s},${top + s} ${x + w - s},${top + hh * 0.15} Z`;
		},
		t: (x, y, w, h) => {
			const top = y - h * 0.85;
			const crossY = y - h * 0.65;
			const cx = x + w * 0.5;
			const stemW = s * 0.9;
			return `M${cx - stemW},${top} L${cx + stemW},${top} L${cx + stemW},${crossY - s * 0.5} L${x + w * 0.85},${crossY - s * 0.5} L${x + w * 0.85},${crossY + s * 0.5} L${cx + stemW},${crossY + s * 0.5} L${cx + stemW},${y - h * 0.1} Q${cx + stemW},${y} ${x + w * 0.7},${y} Q${x + w},${y} ${x + w},${y - h * 0.1} L${x + w - s},${y - h * 0.1} Q${x + w - s},${y - s} ${x + w * 0.7},${y - s} Q${cx - stemW},${y - s} ${cx - stemW},${y - h * 0.1} L${cx - stemW},${crossY + s * 0.5} L${x + w * 0.15},${crossY + s * 0.5} L${x + w * 0.15},${crossY - s * 0.5} L${cx - stemW},${crossY - s * 0.5} Z`;
		},
		u: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.5;
			return `M${x},${top} L${x + s},${top} L${x + s},${y - hh * 0.35} Q${x + s},${y - s} ${cx},${y - s} Q${x + w - s},${y - s} ${x + w - s},${y - hh * 0.35} L${x + w - s},${top} L${x + w},${top} L${x + w},${y} L${x + w - s},${y} L${x + w - s},${y - s} Q${x + w * 0.6},${y + s * 0.3} ${cx},${y} Q${x},${y} ${x},${y - hh * 0.35} Z`;
		},
		v: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.5;
			return `M${x},${top} L${x + s},${top} L${cx},${y - s} L${x + w - s},${top} L${x + w},${top} L${cx + s * 0.5},${y} L${cx - s * 0.5},${y} Z`;
		},
		w: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			return `M${x},${top} L${x + s},${top} L${x + w * 0.25},${y - s} L${x + w * 0.5},${top + s * 2} L${x + w * 0.75},${y - s} L${x + w - s},${top} L${x + w},${top} L${x + w * 0.8},${y} L${x + w * 0.7},${y} L${x + w * 0.5},${top + s * 3} L${x + w * 0.3},${y} L${x + w * 0.2},${y} Z`;
		},
		x: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.5;
			const cy = y - hh * 0.5;
			return `M${x},${top} L${x + s},${top} L${cx},${cy - s * 0.5} L${x + w - s},${top} L${x + w},${top} L${cx + s * 0.7},${cy} L${x + w},${y} L${x + w - s},${y} L${cx},${cy + s * 0.5} L${x + s},${y} L${x},${y} L${cx - s * 0.7},${cy} Z`;
		},
		y: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			const cx = x + w * 0.5;
			const bottom = y + h * 0.25;
			return `M${x},${top} L${x + s},${top} L${cx},${y - s} L${x + w - s},${top} L${x + w},${top} L${cx + s * 0.5},${y} L${cx + s * 0.5},${bottom - h * 0.1} Q${cx + s * 0.5},${bottom} ${x + w * 0.3},${bottom} Q${x},${bottom} ${x},${bottom - h * 0.1} L${x + s},${bottom - h * 0.1} Q${x + s},${bottom - s} ${x + w * 0.3},${bottom - s} Q${cx - s * 0.5},${bottom - s} ${cx - s * 0.5},${bottom - h * 0.1} L${cx - s * 0.5},${y} Z`;
		},
		z: (x, y, w, h) => {
			const hh = h * 0.7;
			const top = y - hh;
			return `M${x},${top} L${x + w},${top} L${x + w},${top + s} L${x + s * 1.5},${y - s} L${x + w},${y - s} L${x + w},${y} L${x},${y} L${x},${y - s} L${x + w - s * 1.5},${top + s} L${x},${top + s} Z`;
		},

		// Special characters
		' ': () => '',
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		'.': (x, y, w, _h) => {
			const cx = x + w * 0.5;
			const cy = y - s;
			const r = s * 0.8;
			return `M${cx},${cy - r} Q${cx + r},${cy - r} ${cx + r},${cy} Q${cx + r},${cy + r} ${cx},${cy + r} Q${cx - r},${cy + r} ${cx - r},${cy} Q${cx - r},${cy - r} ${cx},${cy - r} Z`;
		},
		',': (x, y, w, h) => {
			const cx = x + w * 0.5;
			const top = y - s;
			return `M${cx - s * 0.4},${top} L${cx + s * 0.4},${top} L${cx + s * 0.4},${y} L${cx - s * 0.4},${y + h * 0.15} Z`;
		},
		'!': (x, y, w, h) => {
			const cx = x + w * 0.5;
			const top = y - h;
			const dotY = y - s;
			const r = s * 0.8;
			return `M${cx - s * 0.5},${top} L${cx + s * 0.5},${top} L${cx + s * 0.3},${y - h * 0.3} L${cx - s * 0.3},${y - h * 0.3} Z M${cx},${dotY - r} Q${cx + r},${dotY - r} ${cx + r},${dotY} Q${cx + r},${dotY + r} ${cx},${dotY + r} Q${cx - r},${dotY + r} ${cx - r},${dotY} Q${cx - r},${dotY - r} ${cx},${dotY - r} Z`;
		},
		'?': (x, y, w, h) => {
			const cx = x + w * 0.5;
			const top = y - h;
			const dotY = y - s;
			const r = s * 0.8;
			return `M${x},${top + h * 0.2} Q${x},${top} ${cx},${top} Q${x + w},${top} ${x + w},${top + h * 0.3} Q${x + w},${top + h * 0.5} ${cx},${top + h * 0.5} L${cx},${y - h * 0.3} L${cx - s * 0.5},${y - h * 0.3} L${cx - s * 0.5},${top + h * 0.5 - s} Q${x + w - s},${top + h * 0.5 - s} ${x + w - s},${top + h * 0.3} Q${x + w - s},${top + s} ${cx},${top + s} Q${x + s},${top + s} ${x + s},${top + h * 0.2} Z M${cx},${dotY - r} Q${cx + r},${dotY - r} ${cx + r},${dotY} Q${cx + r},${dotY + r} ${cx},${dotY + r} Q${cx - r},${dotY + r} ${cx - r},${dotY} Q${cx - r},${dotY - r} ${cx},${dotY - r} Z`;
		}
	};

	// Default fallback - create a simple rectangle placeholder
	const defaultPath = (x: number, y: number, w: number, h: number) => {
		const actualH = char === char.toUpperCase() ? h : h * 0.7;
		const startY = y - actualH;
		return `M${x + w * 0.1},${startY} L${x + w * 0.9},${startY} L${x + w * 0.9},${y} L${x + w * 0.1},${y} Z`;
	};

	const pathFn = paths[char] || defaultPath;
	return pathFn(x, y, width, height);
}

export default JigglyText;
