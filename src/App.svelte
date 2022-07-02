<script>
  import LZMA from './lzma';
  import md5 from 'md5';

  let fileName = null;
  let gameMode = null;
  let gameVersion = null;
  let beatmapMD5 = null;
  let player = null;
  let replayMD5 = null;

  let c320 = null;
  let c300 = null;
  let c200 = null;
  let c100 = null;
  let c50 = null;
  let c0 = null;

  let score = null;
  let combo = null;
  let perfect = null;

  let mods = null;

  let lifebar = null;
  let timestamp = null;
  let length = null;
  let replayData = null;
  let unknown = null; // idk what that is, this is basically ported from node-osr

  let initialMapScrollSpeed = null;
  let mapScrollSpeed = null;

  let originalScrollSpeed = null;
  let scrollSpeed = null;
  
  let origbuffer = null;

  const onReplayChange = $event => {
    const [file] = $event.target.files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = loadEvent => {
      const data = new Uint8Array(loadEvent.target.result);
      let offset = 0;
      
      // It's big endian here
      const readBytesAsNumber = nbBytes => {
        let result = 0;
        const slice = data.slice(offset, offset + nbBytes);
        for (let i = 0; i < nbBytes; ++i) {
          result += slice[i] * (256**i);
        }
        offset += nbBytes;
        return result;
      }
      const readByte = () => readBytesAsNumber(1);
      const readShort = () => readBytesAsNumber(2);
      const readInteger = () => readBytesAsNumber(4);
      const readString = () => {
        let strLength = data[offset + 1];
        let i;
        // The way reading string lengths greater than 128 is the following:
        // The length information will span more than just one byte (i.e. [232, 3])
        // The length is big endian, but the first bit (i.e. the first '1' in (232).toString(2) == '11101000')
        // marks whether the length information is continued in the next byte or not (hence the >128 check).
        // When we go to the next byte, we strip the marker bit (^128 (-128 works too)) and we shift the new value
        // at the top (as a bigger value).
        for (i = 1; data[offset + i] > 128; ++i) {
          strLength ^= 128;
          strLength += data[offset + i + 1] << (7*i);
        }
        const start = offset + i + 1;
        const result = String.fromCharCode(...data.slice(start, start + strLength));
        offset += result.length + i + 1;
        return result;
      }

      fileName = file.name;
      gameMode = readByte();
      gameVersion = readInteger();
      beatmapMD5 = readString();
      player = readString();
      replayMD5 = readString();
      c300 = readShort();
      c100 = readShort();
      c50 = readShort();
      c320 = readShort();
      c200 = readShort();
      c0 = readShort();
      score = readInteger();
      combo = readShort();
      perfect = readByte();
      mods = data.slice(offset, offset + 4); offset += 4;
      lifebar = readString();
      timestamp = data.slice(offset, offset + 8); offset += 8;
      length = readInteger();
      origbuffer = data.slice(offset, offset + length);
      replayData = LZMA.decompress(data.slice(offset, offset + length)).split(','); offset += length;
      unknown = data.slice(offset);

      initialMapScrollSpeed = +replayData.find(line => {
        const [,, dist] = line.split('|');
        return +dist > 0;
      }).split('|')[2];
      mapScrollSpeed = initialMapScrollSpeed;
      if (scrollSpeed) {
        adjustMapScrollSpeed({ target: { value: scrollSpeed } });
      }
    }
    reader.readAsArrayBuffer(file);
  }

  const onBeatmapChange = $event => {
    const [file] = $event.target.files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = loadEvent => {
      const data = new Uint8Array(loadEvent.target.result);
      beatmapMD5 = md5(data);
    }
    reader.readAsArrayBuffer(file);
  }

  const download = () => {
    const intArray = [];
    const writeNumberAsBytes = (number, nbBytes) => {
      const result = [];
      for (let i = 0; i < nbBytes; ++i) {
        result.push(number % 256);
        number = number >> 8;
      }
      return result;
    }
    const writeByte = number => writeNumberAsBytes(number, 1);
    const writeShort = number => writeNumberAsBytes(number, 2);
    const writeInteger = number => writeNumberAsBytes(number, 4);
    const writeString = str => {
      const result = [0x0b];
      // Append string length
      let { length } = str;
      do {
        result.push(length % 128 + (length >= 128 ? 128 : 0));
        length = length >> 7;
      } while (length > 0);
      result.push(...str.split('').map(x => x.charCodeAt()));
      return result;
    }
    intArray.push(...writeByte(gameMode));
    intArray.push(...writeInteger(gameVersion));
    intArray.push(...writeString(beatmapMD5));
    intArray.push(...writeString(player));
    intArray.push(...writeString(replayMD5));
    intArray.push(...writeShort(c300));
    intArray.push(...writeShort(c100));
    intArray.push(...writeShort(c50));
    intArray.push(...writeShort(c320));
    intArray.push(...writeShort(c200));
    intArray.push(...writeShort(c0));
    intArray.push(...writeInteger(score));
    intArray.push(...writeShort(combo));
    intArray.push(...writeByte(perfect));
    intArray.push(...mods);
    intArray.push(...writeString(lifebar));
    intArray.push(...timestamp);

    const compressResult = LZMA.compress(
      replayData.map(line => {
        if (!line.trim()) return line;
        const [t, x, dist, rest] = line.split('|');
        if (+dist <= 0) return line;
        return [t, x, mapScrollSpeed, rest].join('|');
      }).join(','),
      1
    );
    intArray.push(...writeInteger(compressResult.length));
    intArray.push(...compressResult);

    // If you need to debug with a noop instead of compressing
    // intArray.push(...writeInteger(length));
    // intArray.push(...origbuffer);

    intArray.push(...unknown);

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([new Uint8Array(intArray).buffer], { type: 'application/osu' }));
    link.download = fileName;
    link.click();
  }

  const adjustScrollSpeed = $event => {
    if (!originalScrollSpeed) return;
    const newMapScrollSpeed = +$event.target.value;
    scrollSpeed = (newMapScrollSpeed / initialMapScrollSpeed) * originalScrollSpeed;
  }

  const adjustMapScrollSpeed = $event => {
    const newScrollSpeed = +$event.target.value;
    mapScrollSpeed = (newScrollSpeed / originalScrollSpeed) * initialMapScrollSpeed;
  }
</script>

<main>
  <h1>the osu! replay edit thing yes</h1>

  <label>
    Upload your replay file here<br />
    <input type="file" on:change={onReplayChange} />
  </label>

  <p>
    file name = {fileName}<br />
    game mode = {gameMode}<br />
    game version = {gameVersion}<br />
    beatmap MD5 = {beatmapMD5}<br />
    replay MD5 = {replayMD5}<br />
    replay player name = <input type="text" bind:value={player} /><br />
  </p>

  <p>
    {score} (x{combo}), {c320} | {c300} | {c200} | {c100} | {c50} | {c0}
  </p>

  <p>
    <label>
      Overwrite beatmap MD5 (e.g. after edit uploads)<br />
      <input type="file" on:change={onBeatmapChange} />
    </label>
  </p>

  <div class="container">
    Tweak scroll speed<br />
    <small>
      Note: The "map scroll value" is <b>not</b> the osu!mania scroll speed and the scale will be different for every map
      (I have no idea what the value actually represents yet),
      but all you need to know is that smaller is slower and bigger is faster.
      If you know the original scroll speed, you can input it and the target scroll speed you want and
      this will scale the numbers accordingly. If not, you'll have to do trial and error on the "map scroll value"
      (but honestly just open the original replay and check the scroll speed it's so much easier)
    </small>
    <div class="speed-container">
      <input class="speed" type="range" bind:value={originalScrollSpeed} min="0" max="40" step="1" />
      <div class="speed-label">
        original scroll speed = {originalScrollSpeed || '?'}
      </div>
    </div>
    <div class="speed-container">
      {#if !originalScrollSpeed}
      <input class="speed" type="range" bind:value={mapScrollSpeed} min="0" max="100" step="0.5" />
      <div class="speed-label">
        map scroll value = {mapScrollSpeed}
      </div>
      {:else}
      <input class="speed" type="range" bind:value={scrollSpeed} min="0" max="40" step="1" on:change={adjustMapScrollSpeed} />
      <div class="speed-label">
        wanted scroll speed = {scrollSpeed || originalScrollSpeed}<br />
        (map scroll value = {mapScrollSpeed})
      </div>
      {/if}
    </div>
  </div>

  <p class="footnotes"><small>
    Notes:<br />
    When you download the replay, save it somewhere, then open it (i.e. don't open it directly from the temp folder).<br />
    Also keep in mind you have to delete existing scores from the replay before importing another one (i.e. when you're testing different scroll speeds)<br /><br />
    If you are dealing with multiple replays in a row, the original and wanted scroll speed values are kept and numbers are still scaled accordingly automatically,
    so you can basically set those values before uploading, and then just brrrrrrr the replay files as long as they're the same scroll speed.
  </small></p>

  <button on:click={download}>
    Download edited replay
  </button>
</main>

<style>
  :root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }

  main {
    text-align: center;
    padding: 1em;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    font-size: 4rem;
    font-weight: 100;
    line-height: 1.1;
    margin: 2rem auto;
  }

  label {
    text-align: center;
    cursor: pointer;
  }

  p, .container {
    text-align: left;
    max-width: 800px;
    margin: 1em auto;
  }

  .speed-container {
    display: flex;
    align-items: center;
  }

  .speed-label {
    width: 300px;
  }

  .speed {
    width: 80%;
    margin: 1em;
  }

  .footnotes {
    font-size: .8em;
  }
</style>
