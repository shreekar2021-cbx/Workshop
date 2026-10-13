// Serial delivery keeps transcript order; stable IDs prevent duplicate commits.
export class SegmentQueue {
  constructor({send,commit,onState}) { this.send = send; this.commit = commit; this.onState = onState; this.items = []; this.running = false; this.failed = null; this.delivered = new Set(); }
  add(segment) { if(this.delivered.has(segment.id) || this.items.some(s => s.id === segment.id)) return; this.items.push(segment); this.items.sort((a,b) => a.sequence-b.sequence); this.onState(this); this.process(); }
  async process() {
    if (this.running || this.failed || !this.items.length) return;
    this.running = true; this.onState(this);
    while (this.items.length) {
      const segment = this.items[0];
      try {
        const text = await this.send(segment);
        if (!this.delivered.has(segment.id)) { await this.commit(segment,text); this.delivered.add(segment.id); }
        this.items.shift();
      } catch(error) { this.failed = error; break; }
    }
    this.running = false; this.onState(this);
  }
  retry() { this.failed = null; this.process(); }
}
