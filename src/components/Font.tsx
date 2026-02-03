import { useState, type FC, useEffect } from 'react';

interface Props {}

const Font: FC<Props> = () => {

  const path = `M11050 11274
  c -14 -1 -88 -8 -165 -14 -510 -40 -802 -97 -983 -189 -325 -166 -719
    -880 -1077 -1956 -176 -528 -390 -1315 -541 -1987 l-38 -168 -1318 0
  c -1052 0 -1318 3 -1318 13 0 7 153 777 340 1712 187 935 340 1708 340 1719
    0 16 -6 18 -46 13 l-46 -5 6 52
  c 3 28 9 61 12 74 8 28 14 28 -239 -3
    -830 -101 -1743 -157 -2067 -126 -305 29 -535 105 -738 245 -46 31 -87 54 -91
    51 -11 -6 18 -170 53 -299 70 -265 218 -530 390 -701 144 -143 300 -213 523
    -235 117 -11 447 1 659 25 171 19 174 19 174 -2 0 -10 -45 -243 -99 -518 -55
    -275 -166 -831 -246 -1235 -80 -404 -148 -745 -150 -757 -5 -23 -7 -23 -188
    -23 -477 0 -868 -65 -1099 -181 -160 -81 -300 -209 -411 -376 -97 -145 -270
    -517 -250 -536 3 -4 37 10 75 29 39 19 71 34 73 32 1 -2 -12 -41 -30 -88 -20
    -51 -30 -89 -25 -94 6 -6 68 18 157 61 457 219 898 334 1346 350 l177 6 0 -24
  c 0 -13 -97 -507 -215 -1099 -516 -2586 -553 -2778 -576 -2968 -15 -126 -4
    -190 44 -247 18 -21 43 -62 57 -89 50 -101 160 -135 377 -116 154 14 290 43
    448 95 127 42 335 129 380 159 l23 15 -25 78
  c -34 106 -40 240 -19 403 9 69
    91 499 182 955 183 922 366 1841 481 2425 42 212 80 391 86 398 7 9 284 12
    1323 12 l1314 0 -5 -22
  c -28 -128 -79 -485 -104 -728 -106 -1033 -6 -1898 280
    -2402 184 -327 335 -500 549 -628 205 -123 443 -180 755 -180 648 0 1082 220
    1255 637 40 95 78 244 87 335 7 77 2 81 -53 47 l-34 -21 1 29
  c 0 15 4 55 9 88
    4 33 4 64 0 68 -4 5 -47 -18 -96 -50 -196 -127 -430 -225 -606 -253 -97 -16
    -311 -8 -393 15 -162 44 -326 162 -413 297 -65 102 -120 285 -157 524 -60 393
    -33 1237 61 1869 30 206 57 350 66 363 8 8 53 12 162 12 362 1 563 68 753 253
    153 148 246 338 303 616 32 157 28 171 -39 130 -18 -11 -35 -18 -37 -16 -2 2
    3 41 11 87 9 49 11 88 6 93 -5 5 -50 -15 -106 -48 -291 -172 -598 -286 -829
    -310 l-69 -8 7 39
  c 19 105 102 490 142 659 339 1434 840 2556 1501 3362 45 56
    83 105 83 108 0 4 -41 5 -90 3 -50 -2 -90 -2 -90 -1 0 2 25 32 55 68 52 60 62
    87 32 84 -7 -1 -23 -3 -37 -5z
    `;

  const path2 = `
    M 213.1 6.7
    c -32.4 -14.4 -73.7, 0 -88.1, 30.6
    C 110.6,4.9,67.5-9.5,36.9,6.7
    C 2.8,22.9-13.4,62.4,13.5,110.9
    C 33.3,145.1,67.5,170.3,125,217
    c 59.3-46.7,93.5-71.9,111.5-106.1
    C 263.4,64.2,247.2,22.9,213.1,6.7
    z`

  const path3 = `
    M 50, 25
    l 25 50
    m -25 -50
    l -25 50
    m 12.5 -25
    l 25 0
  `

  const currentPath = path3;
  const [jigglyPath, setJigglyPath] = useState(currentPath);

  type CommandObject = {
    command: string;
    value: string;
  };

  const parseInput = (input: string): CommandObject[] => {
    input = input.replace(/\n/g, '');
    const commands: CommandObject[] = [];
    const regex = /([a-zA-Z])\s*([^a-zA-Z]+)/g;

    let match;
    while ((match = regex.exec(input)) !== null) {
      const [, command, value] = match;
      commands.push({ command, value });
    }

    return commands;
  }

  // fn to return num between negative and positive offset
  const randomOffset = (num: number, offset: number) => {
    return num + (Math.random() * offset * 2) - offset;
  }

  const makeRandom = (input: string) => {
    const commands = parseInput(input);
    commands.forEach((command) => {
      if (command.command === 'l') {
        const [x, y] = command.value.split(' ').map(Number);
        const newX = randomOffset(x, 2);
        const newY = randomOffset(y, 2);
        command.value = `${newX},${newY}`;
      }
    })
    return commands.map(({ command, value }) => `${command} ${value}`).join(' ');
  }


  // react set interval 500ms
  // set state to random path
  useEffect(() => {
    const interval = setInterval(() => {
      // setJigglyPath(makeRandom(currentPath));
    }, 240);
    return () => clearInterval(interval);
  });

  return (
    <div>
      <button onClick={() => setJigglyPath(makeRandom(currentPath))}>random</button><br /><br /><br />
      <svg viewBox="0 0 100 100" style={{ width: '100px', height: '100px', background: 'gray'}}>
        <path d={jigglyPath} />
      </svg>
      <p>{JSON.stringify(parseInput(jigglyPath))}</p>
    </div>
  );
};

export default Font;