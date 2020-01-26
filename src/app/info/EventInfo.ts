export class EventInfo {

  constructor(private event: Event) {}

  getFields(): string {
    return `type=${ this.event.type }, target=${ event.target }, srcElement=${ event.srcElement }, eventPhase=${ event.eventPhase }`;
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
