import './App.css';
import { JigglyText } from './lib';

function App() {
	return (
		<div style={{ padding: '40px' }}>
			<h1>JigglyFonts Demo</h1>

			<div style={{ marginBottom: '40px' }}>
				<h2>Default (Hello)</h2>
				<JigglyText style={{ width: '400px', height: '100px' }} />
			</div>

			<div style={{ marginBottom: '40px' }}>
				<h2>Custom Text</h2>
				<JigglyText
					text='ABCDEFGHIJKLMNOPQRSTUVWXYZ'
					fill='#ff6b6b'
					fontSize={96}
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
		</div>
	);
}

export default App;
