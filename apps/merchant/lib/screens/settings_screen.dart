import 'package:flutter/material.dart';

import '../core/platform.dart';
import '../core/session.dart';
import '../core/theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.session});

  final SessionController session;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _device = 'Android device';

  @override
  void initState() {
    super.initState();
    MerchantPlatform.deviceLabel().then((value) {
      if (mounted) setState(() => _device = value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final session = widget.session;
    final tokens = session.theme?.light;
    final selected = session.selected;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Business',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        for (final membership in session.memberships)
          if (membership.businessId != null)
            ListTile(
              onTap: () => session.selectBusiness(membership),
              leading: Icon(
                membership.businessId == selected?.businessId
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
              ),
              title: Text(membership.businessName ?? 'Business'),
              subtitle: Text(
                '${membership.vertical ?? ''} · ${membership.role}',
              ),
            ),
        const Divider(height: 32),
        Text(
          'Storefront theme',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        if (tokens == null)
          Text(
            'Using the default Rosso preset.',
            style: theme.textTheme.bodySmall,
          )
        else
          Wrap(
            spacing: 8,
            children: [
              for (final colour in [
                tokens.primary,
                tokens.accent,
                tokens.surface,
                tokens.onSurface,
              ])
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: hexColor(colour),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: theme.colorScheme.outline),
                  ),
                ),
            ],
          ),
        const SizedBox(height: 8),
        Text(
          'Published from the web dashboard. Version ${session.theme?.version ?? '—'}.',
          style: theme.textTheme.bodySmall,
        ),
        const Divider(height: 32),
        Text(
          'Device',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Text(_device, style: theme.textTheme.bodyMedium),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () async {
            final started = await MerchantPlatform.startOrderService();
            if (!context.mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  started
                      ? 'Order alert service started'
                      : 'Not available on this device',
                ),
              ),
            );
          },
          icon: const Icon(Icons.notifications_active_outlined),
          label: const Text('Start order alert service'),
        ),
        const SizedBox(height: 8),
        Text(
          'FCM registration arrives with the Firebase project. The foreground service keeps alerts alive meanwhile.',
          style: theme.textTheme.bodySmall,
        ),
        const Divider(height: 32),
        Text(
          'API',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          session.api.baseUrl,
          style: theme.textTheme.bodySmall?.copyWith(fontFamily: 'monospace'),
        ),
        const SizedBox(height: 24),
        FilledButton.tonal(
          onPressed: session.logout,
          child: const Text('Sign out'),
        ),
      ],
    );
  }
}
