class OrderAction {
  const OrderAction(this.to, this.label);

  final String to;
  final String label;
}

const _next = <String, List<OrderAction>>{
  'PLACED': [
    OrderAction('ACCEPTED', 'Accept'),
    OrderAction('REJECTED', 'Reject'),
  ],
  'PREPARING': [OrderAction('READY', 'Mark ready')],
  'READY': [OrderAction('OUT_FOR_DELIVERY', 'Out for delivery')],
  'OUT_FOR_DELIVERY': [OrderAction('DELIVERED', 'Delivered')],
  'DELIVERED': [OrderAction('COMPLETED', 'Complete')],
  'SCHEDULED': [OrderAction('IN_PROGRESS', 'Start service')],
  'IN_PROGRESS': [OrderAction('COMPLETED', 'Complete')],
};

List<OrderAction> actionsFor({required String status, required String kind}) {
  if (status == 'ACCEPTED') {
    return kind == 'booking'
        ? const [OrderAction('SCHEDULED', 'Schedule')]
        : const [OrderAction('PREPARING', 'Start preparing')];
  }
  return _next[status] ?? const [];
}

const activeStatuses = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'SCHEDULED',
  'IN_PROGRESS',
];
