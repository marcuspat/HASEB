import React from 'react';
import { Settings, Save, RefreshCw, Bell, Database, Palette, Users, Shield } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = React.useState({
    notifications: {
      email: true,
      push: true,
      evaluationComplete: true,
      agentStatus: true,
      errors: true,
    },
    display: {
      theme: 'light',
      denseView: false,
      animations: true,
      showAdvancedMetrics: true,
    },
    data: {
      retentionPeriod: 90,
      autoCleanup: true,
      exportFormat: 'json',
    },
    api: {
      baseUrl: '',
      apiKey: '',
      timeout: 30000,
    },
  });

  const handleSave = () => {
    console.log('Saving settings:', settings);
    // In a real implementation, this would save to the backend
  };

  const handleReset = () => {
    console.log('Resetting to default settings');
    // In a real implementation, this would reset to defaults
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Configure your HASEB dashboard preferences
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleReset} className="btn btn-secondary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Default
          </button>
          <button onClick={handleSave} className="btn btn-primary">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Navigation */}
        <div className="card">
          <nav className="space-y-1">
            <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-md">
              <Bell className="h-4 w-4 mr-3" />
              Notifications
            </button>
            <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md">
              <Palette className="h-4 w-4 mr-3" />
              Display
            </button>
            <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md">
              <Database className="h-4 w-4 mr-3" />
              Data & Storage
            </button>
            <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md">
              <Users className="h-4 w-4 mr-3" />
              Users & Teams
            </button>
            <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md">
              <Shield className="h-4 w-4 mr-3" />
              Security
            </button>
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notifications Settings */}
          <div className="card">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Notifications
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure how and when you receive notifications
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                  <p className="text-sm text-gray-600">Receive notifications via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.email}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, email: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Push Notifications</h4>
                  <p className="text-sm text-gray-600">Receive browser push notifications</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.push}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, push: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Evaluation Complete</h4>
                  <p className="text-sm text-gray-600">Notify when evaluations finish</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.evaluationComplete}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, evaluationComplete: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Agent Status Changes</h4>
                  <p className="text-sm text-gray-600">Notify when agent status changes</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.agentStatus}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, agentStatus: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Error Alerts</h4>
                  <p className="text-sm text-gray-600">Notify about evaluation errors</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.errors}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, errors: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Display Settings */}
          <div className="card">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Palette className="h-5 w-5 mr-2" />
                Display Preferences
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Customize the dashboard appearance
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme
                </label>
                <select
                  value={settings.display.theme}
                  onChange={(e) => setSettings({
                    ...settings,
                    display: { ...settings.display, theme: e.target.value }
                  })}
                  className="select-field w-full"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Dense View</h4>
                  <p className="text-sm text-gray-600">Show more information in less space</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.display.denseView}
                    onChange={(e) => setSettings({
                      ...settings,
                      display: { ...settings.display, denseView: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Animations</h4>
                  <p className="text-sm text-gray-600">Enable UI animations and transitions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.display.animations}
                    onChange={(e) => setSettings({
                      ...settings,
                      display: { ...settings.display, animations: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Advanced Metrics</h4>
                  <p className="text-sm text-gray-600">Show detailed technical metrics</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.display.showAdvancedMetrics}
                    onChange={(e) => setSettings({
                      ...settings,
                      display: { ...settings.display, showAdvancedMetrics: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Data Settings */}
          <div className="card">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Data & Storage
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure data retention and export settings
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Retention Period (days)
                </label>
                <input
                  type="number"
                  value={settings.data.retentionPeriod}
                  onChange={(e) => setSettings({
                    ...settings,
                    data: { ...settings.data, retentionPeriod: parseInt(e.target.value) }
                  })}
                  className="input-field w-full"
                  min="1"
                  max="365"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Auto Cleanup</h4>
                  <p className="text-sm text-gray-600">Automatically remove old data</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.data.autoCleanup}
                    onChange={(e) => setSettings({
                      ...settings,
                      data: { ...settings.data, autoCleanup: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <select
                  value={settings.data.exportFormat}
                  onChange={(e) => setSettings({
                    ...settings,
                    data: { ...settings.data, exportFormat: e.target.value }
                  })}
                  className="select-field w-full"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;