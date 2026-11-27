import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/session.dart';

class InsightsScreen extends StatefulWidget {
  const InsightsScreen({
    super.key,
    required this.session,
    required this.businessId,
  });

  final SessionController session;
  final String businessId;

  @override
  State<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends State<InsightsScreen> {
  AnalyticsSnapshot? _snapshot;
  String? _error;
  int _days = 7;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final snapshot = await widget.session.api.analytics(
        widget.businessId,
        days: _days,
      );
      if (!mounted) return;
      setState(() {
        _snapshot = snapshot;
        _error = null;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final snapshot = _snapshot;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Text(
                'Last $_days days',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              SegmentedButton<int>(
                segments: const [
                  ButtonSegment(value: 7, label: Text('7d')),
                  ButtonSegment(value: 30, label: Text('30d')),
                ],
                selected: {_days},
                onSelectionChanged: (value) {
                  setState(() => _days = value.first);
                  _load();
                },
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
          ],
          if (snapshot == null)
            const Padding(
              padding: EdgeInsets.only(top: 80),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            const SizedBox(height: 16),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.6,
              children: [
                _kpi(theme, 'GMV', formatPeso(snapshot.gmvCentavos)),
                _kpi(theme, 'Orders', '${snapshot.ordersPlaced}'),
                _kpi(theme, 'AOV', formatPeso(snapshot.aovCentavos)),
                _kpi(
                  theme,
                  'Acceptance',
                  snapshot.acceptanceRate == null
                      ? '—'
                      : '${(snapshot.acceptanceRate! * 100).round()}%',
                ),
                _kpi(
                  theme,
                  'Prep p50',
                  formatDuration(snapshot.prepP50Seconds),
                ),
                _kpi(
                  theme,
                  'Fulfillment p90',
                  formatDuration(snapshot.fulfillmentP90Seconds),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Text(
              'Top items',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            if (snapshot.topItems.isEmpty)
              Text('No sold items yet.', style: theme.textTheme.bodySmall)
            else
              for (final item in snapshot.topItems)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text((item as Map<String, dynamic>)['name'] as String),
                  subtitle: Text('x${item['quantity']}'),
                  trailing: Text(
                    formatPeso((item['revenueCentavos'] as num).toInt()),
                  ),
                ),
          ],
        ],
      ),
    );
  }

  Widget _kpi(ThemeData theme, String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: theme.colorScheme.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
