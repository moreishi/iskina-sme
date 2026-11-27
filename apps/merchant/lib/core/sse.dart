import 'dart:async';

class SseEvent {
  const SseEvent(this.event, this.data);

  final String event;
  final String data;
}

/// Minimal SSE decoder: blank line terminates an event.
Stream<SseEvent> decodeSse(Stream<String> lines) async* {
  String? event;
  final data = <String>[];

  await for (final line in lines) {
    if (line.isEmpty) {
      if (event != null) {
        yield SseEvent(event, data.join('\n'));
      }
      event = null;
      data.clear();
      continue;
    }
    if (line.startsWith('event:')) {
      event = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      data.add(line.substring(5).trimLeft());
    }
  }
}
