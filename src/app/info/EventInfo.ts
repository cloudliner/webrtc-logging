export class EventInfo {

  constructor(private event: Event) {}
  getFields(): string {
    // tslint:disable-next-line: max-line-length
    return `type=${ this.event.type }, target=${ this.event.target }, currentTarget=${ this.event.currentTarget }, eventPhase=${ this.event.eventPhase }`;
  }
  toString(): string {
    return `{ ${ this.getFields() } }`;
  }
}

export class MediaStreamTrackEventInfo extends EventInfo {

  constructor(private mediaStreamTrackEvent: MediaStreamTrackEvent) {
    super(mediaStreamTrackEvent);
  }
  getFields(): string {
    return super.getFields() + `, track=${ this.mediaStreamTrackEvent.track }`;
  }
}
