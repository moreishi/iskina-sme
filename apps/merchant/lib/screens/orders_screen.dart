import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/order_actions.dart';
import '../core/session.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({
    super.key,
    required this.session,
    required this.businessId,
  });

  final SessionController session;
  final String businessId;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  List<MerchantOrder> _orders = const [];
  String? _error;
  String? _busyId;
  int _filter = 0;
  Timer? _poll;
  StreamSubscription<void>? _events;

  @override
  void initState() {
    super.initState();
    _load();
    _events = widget.session.api
        .orderEvents(widget.businessId)
        .listen((_) => _load());
    _poll = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  @override
  void dispose() {
    _poll?.cancel();
    _events?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final orders = await widget.session.api.orders(widget.businessId);
      if (!mounted) return;
      setState(() {
        _orders = orders;
        _error = null;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  Future<void> _transition(MerchantOrder order, OrderAction action) async {
    if (action.to == 'REJECTED') {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Reject this order?'),
          content: Text('${order.number} will be closed as rejected.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Reject'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }

    setState(() => _busyId = order.id);
    try {
      await widget.session.api.transition(
        businessId: widget.businessId,
        orderId: order.id,
        to: action.to,
      );
      await _load();
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _cashReceived(MerchantOrder order) async {
    setState(() => _busyId = order.id);
    try {
      await widget.session.api.cashReceived(
        businessId: widget.businessId,
        orderId: order.id,
      );
      await _load();
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  List<MerchantOrder> get _visible {
    final filtered = switch (_filter) {
      0 => _orders.where((order) => activeStatuses.contains(order.status)),
      1 => _orders.where((order) => !activeStatuses.contains(order.status)),
      _ => _orders,
    };
    return filtered.toList()..sort((a, b) => b.placedAt.compareTo(a.placedAt));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Row(
            children: [
              for (final (index, label) in const [
                (0, 'Active'),
                (1, 'Done'),
                (2, 'All'),
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(label),
                    selected: _filter == index,
                    onSelected: (_) => setState(() => _filter = index),
                  ),
                ),
              const Spacer(),
              Text(
                'live',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 6),
              Icon(Icons.bolt, size: 14, color: theme.colorScheme.primary),
            ],
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              _error!,
              style: TextStyle(color: theme.colorScheme.error),
            ),
          ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: _visible.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 120),
                      Center(child: Text('No orders in this view.')),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _visible.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) =>
                        _orderCard(context, _visible[index]),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _orderCard(BuildContext context, MerchantOrder order) {
    final theme = Theme.of(context);
    final busy = _busyId == order.id;
    final actions = actionsFor(status: order.status, kind: order.kind);
    final cashable = order.status == 'DELIVERED' || order.status == 'COMPLETED';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: theme.colorScheme.outline),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.number,
                        style: theme.textTheme.labelSmall?.copyWith(
                          fontFamily: 'monospace',
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        formatPeso(order.totalCentavos),
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        '${order.contactName ?? 'Customer'} · ${order.contactPhone}',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.secondaryContainer,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    statusLabel(order.status),
                    style: theme.textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            for (final line in order.lines)
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Row(
                  children: [
                    Expanded(child: Text('${line.quantity}× ${line.name}')),
                    Text(
                      formatPeso(line.lineTotalCentavos),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 8),
            Text(
              [
                'Placed ${formatTime(order.placedAt)}',
                if (order.scheduledAt != null)
                  'Scheduled ${formatTime(order.scheduledAt!)}',
                if (order.address != null) order.address!,
              ].join(' · '),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final action in actions)
                  action.to == 'REJECTED'
                      ? OutlinedButton(
                          onPressed: busy
                              ? null
                              : () => _transition(order, action),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: theme.colorScheme.error,
                          ),
                          child: Text(action.label),
                        )
                      : FilledButton(
                          onPressed: busy
                              ? null
                              : () => _transition(order, action),
                          child: Text(action.label),
                        ),
                if (cashable)
                  order.cashReceivedAt != null
                      ? const Chip(label: Text('Cash received'))
                      : OutlinedButton(
                          onPressed: busy ? null : () => _cashReceived(order),
                          child: const Text('Confirm cash'),
                        ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
