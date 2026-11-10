/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'QuickAdd',
  displayName: 'Add expense',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    $accent: '#14B8A6',
    $widgetBackground: '#0B1220',
  },
};
