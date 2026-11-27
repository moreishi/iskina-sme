import 'package:flutter_test/flutter_test.dart';
import 'package:iskina_merchant/core/order_actions.dart';

void main() {
  test('delivery walks the board actions', () {
    expect(actionsFor(status: 'PLACED', kind: 'delivery').map((a) => a.to), [
      'ACCEPTED',
      'REJECTED',
    ]);
    expect(
      actionsFor(status: 'ACCEPTED', kind: 'delivery').single.to,
      'PREPARING',
    );
    expect(
      actionsFor(status: 'READY', kind: 'delivery').single.to,
      'OUT_FOR_DELIVERY',
    );
    expect(
      actionsFor(status: 'OUT_FOR_DELIVERY', kind: 'delivery').single.to,
      'DELIVERED',
    );
    expect(
      actionsFor(status: 'DELIVERED', kind: 'delivery').single.to,
      'COMPLETED',
    );
  });

  test('booking schedules instead of preparing', () {
    expect(
      actionsFor(status: 'ACCEPTED', kind: 'booking').single.to,
      'SCHEDULED',
    );
    expect(
      actionsFor(status: 'SCHEDULED', kind: 'booking').single.to,
      'IN_PROGRESS',
    );
    expect(
      actionsFor(status: 'IN_PROGRESS', kind: 'booking').single.to,
      'COMPLETED',
    );
  });

  test('terminal states offer nothing', () {
    for (final status in ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED']) {
      expect(actionsFor(status: status, kind: 'delivery'), isEmpty);
    }
  });

  test('active statuses are the board default', () {
    expect(activeStatuses, contains('PLACED'));
    expect(activeStatuses, isNot(contains('COMPLETED')));
  });
}
