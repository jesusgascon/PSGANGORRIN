class CofraBeatRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 4096;
    this.buffer = new Float32Array(this.chunkSize);
    this.offset = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];

    if (output) {
      output.fill(0);
    }

    if (!input?.length) {
      return true;
    }

    let index = 0;
    while (index < input.length) {
      const available = this.chunkSize - this.offset;
      const remaining = input.length - index;
      const length = Math.min(available, remaining);

      this.buffer.set(input.subarray(index, index + length), this.offset);
      this.offset += length;
      index += length;

      if (this.offset === this.chunkSize) {
        const chunk = new Float32Array(this.buffer);
        this.port.postMessage({ audio: chunk }, [chunk.buffer]);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("cofrabeat-recorder", CofraBeatRecorderProcessor);
