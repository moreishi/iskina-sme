import 'package:flutter_test/flutter_test.dart';
import 'package:iskina_merchant/core/sse.dart';

void main() {
  test('decodes events separated by blank lines', () async {
    final events = await decodeSse(
      Stream.fromIterable([
        'event: ready',
        'data: {"businessId":"b1"}',
        '',
        'event: orders',
        'data: {"count":2}',
        '',
        'event: ping',
        'data: {}',
        '',
      ]),
    ).toList();

    expect(events.map((event) => event.event), ['ready', 'orders', 'ping']);
    expect(events[1].data, '{"count":2}');
  });

  test('joins multi-line data and ignores comment lines', () async {
    final events = await decodeSse(
      Stream.fromIterable([
        ': keep-alive',
        'event: orders',
        'data: line one',
        'data: line two',
        '',
      ]),
    ).toList();

    expect(events.single.data, 'line one\nline two');
  });

  test('drops an event with no name', () async {
    final events = await decodeSse(Stream.fromIterable(['data: orphan', '']))
        .toList();
    expect(events, isEmpty);
  });
}
