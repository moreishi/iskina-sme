String formatPeso(int centavos) => 'PHP ${(centavos / 100).toStringAsFixed(2)}';

String statusLabel(String status) => status.replaceAll('_', ' ');

String formatTime(DateTime value) {
  final local = value.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$month-$day $hour:$minute';
}

String formatDuration(double? seconds) {
  if (seconds == null) return '—';
  final minutes = (seconds / 60).round();
  if (minutes < 60) return '$minutes min';
  return '${minutes ~/ 60}h ${minutes % 60}m';
}
