import './App.css';
import { JigglyText } from './lib';

function App() {
	return (
		<div style={{ padding: '40px' }}>
			<h1>JigglyFonts Demo</h1>

			<div style={{ marginBottom: '40px' }}>
				<h2>Default (Hello)</h2>
				<JigglyText text='Hello' fill='#FFF' />
			</div>

			<div style={{ marginBottom: '40px' }}>
				<JigglyText
					text='ABCDEFGHIJKLMNOPQRSTUVWXYZ'
					fill='#ff6b6b'
					fontSize={220}
					intensity={2}
					speed={80}
					style={{ width: '500px', height: '120px' }}
				/>
			</div>

			<div style={{ marginBottom: '40px' }}>
				<h2>Slow Jiggle</h2>
				<JigglyText
					text='abcdefghijklmnopqrstuvwxyz., ,, !, ?'
					fill='#4ecdc4'
					fontSize={64}
					intensity={1}
					speed={150}
					style={{ width: '350px', height: '90px' }}
				/>
			</div>

			<div style={{ marginBottom: '40px' }}>
				<h2>Static (No Animation)</h2>
				<JigglyText
					text='Hello'
					fill='#333'
					stroke='#000'
					strokeWidth={1}
					animated={false}
					style={{ width: '300px', height: '80px' }}
				/>
			</div>

			<div style={{ marginBottom: '40px' }}>
				<h2>Mouse Interaction (hover over the text!)</h2>
				<JigglyText
					text='Touch Me'
					fill='#9b59b6'
					fontSize={80}
					animated={false}
					interactsWithMouse={true}
					mouseRadius={60}
					mouseStrength={20}
					style={{ width: '500px', height: '120px' }}
				/>
			</div>

			<div style={{ marginBottom: '40px' }}>
				<h2>Jiggle + Mouse Interaction</h2>
				<JigglyText
					text='Wobbly'
					fill='#e74c3c'
					fontSize={80}
					intensity={1}
					speed={100}
					interactsWithMouse={true}
					mouseRadius={40}
					mouseStrength={15}
					style={{ width: '400px', height: '120px' }}
				/>
			</div>

			<div style={{ marginBottom: '40px' }}>
				<JigglyText
					text='JIGGLYFONTS'
					fontSize={250}
					intensity={8.5}
					speed={120}
					gradient={{
						type: 'linear',
						angle: 90,
						stops: [
							{ offset: 0, color: '#ff6b6b' },
							{ offset: 25, color: '#feca57' },
							{ offset: 50, color: '#48dbfb' },
							{ offset: 75, color: '#ff9ff3' },
							{ offset: 100, color: '#54a0ff' }
						]
					}}
				/>
			</div>

			<div style={{ marginBottom: '40px' }}>
				<h2>Radial Gradient</h2>
				<JigglyText
					text='Glow'
					fontSize={100}
					intensity={2}
					speed={60}
					gradient={{
						type: 'radial',
						stops: [
							{ offset: 0, color: '#fff' },
							{ offset: 50, color: '#f39c12' },
							{ offset: 100, color: '#e74c3c' }
						]
					}}
					style={{ width: '350px', height: '140px' }}
				/>
			</div>

			<div style={{ marginBottom: '40px' }}>
				<h2>Wave Mode</h2>
				<JigglyText
					text='Wavy Text'
					fill='#9b59b6'
					fontSize={80}
					intensity={3}
					speed={30}
					waveMode={true}
					waveDelay={150}
					style={{ width: '500px', height: '120px' }}
				/>
			</div>

			<div style={{ marginBottom: '40px' }}>
				<h2>Wave + Gradient</h2>
				<JigglyText
					text='Ocean'
					fontSize={100}
					intensity={4}
					speed={25}
					waveMode={true}
					waveDelay={200}
					gradient={{
						type: 'linear',
						angle: 180,
						stops: [
							{ offset: 0, color: '#0099ff' },
							{ offset: 50, color: '#00d4ff' },
							{ offset: 100, color: '#00ff88' }
						]
					}}
					style={{ width: '400px', height: '140px' }}
				/>
			</div>
		</div>
	);
}

export default App;
