import { useState, useEffect } from 'react';
import axios from 'axios';

interface Camera {
  id: string;
  name: string;
  modelName: string;
  ipAddress: string;
  port: number;
  signalStrength: number;
  isConnected: boolean;
  lastSeen: string;
}

export function CameraDiscovery() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const discover = async () => {
    setScanning(true);
    setError(null);

    try {
      const { data } = await axios.get('/api/ccapi/discover?scanDuration=5000');

      if (data.success) {
        setCameras(data.cameras);
      } else {
        setError('Discovery failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover cameras');
    } finally {
      setScanning(false);
    }
  };

  const connect = async (ip: string) => {
    setConnecting(ip);
    setError(null);

    try {
      const { data } = await axios.post(`/api/ccapi/cameras/${ip}/connect`);

      if (data.success) {
        // Update camera status
        setCameras((prev) =>
          prev.map((cam) => (cam.ipAddress === ip ? { ...cam, isConnected: true } : cam)),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async (ip: string) => {
    try {
      await axios.post(`/api/ccapi/cameras/${ip}/disconnect`);
      setCameras((prev) =>
        prev.map((cam) => (cam.ipAddress === ip ? { ...cam, isConnected: false } : cam)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

  const getSignalColor = (strength: number) => {
    if (strength >= 80) return 'text-green-500';
    if (strength >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSignalBars = (strength: number) => {
    const bars = Math.ceil(strength / 25);
    return '▁▃▅▇'.substring(0, bars);
  };

  useEffect(() => {
    discover(); // Auto-discover on mount
  }, []);

  return (
    <div className="ccapi-discovery p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Camera Discovery</h2>
        <button
          onClick={discover}
          disabled={scanning}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover: bg-blue-700 disabled:opacity-50, disabled:cursor-not-allowed"
        >
          {scanning ? (
            <>
              <span className="animate-spin inline-block mr-2">⟳</span>
              Scanning...
            </>
          ) : (
            '🔍 Discover Cameras'
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {cameras.length === 0 && !scanning && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No cameras found</p>
          <p className="text-sm">
            Make sure your cameras are powered on and connected to the same WiFi network
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md: grid-cols-2, lg:grid-cols-3 gap-4">
        {cameras.map((camera) => (
          <div
            key={camera.id}
            className={`camera-card border-2 rounded-lg p-4 transition-all ${
              camera.isConnected
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">{camera.name}</h3>
                <p className="text-sm text-gray-600">{camera.modelName}</p>
              </div>
              <span className={`text-2xl ${getSignalColor(camera.signalStrength)}`}>
                {getSignalBars(camera.signalStrength)}
              </span>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">IP:</span>
                <span className="font-mono">{camera.ipAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Port:</span>
                <span className="font-mono">{camera.port}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Signal:</span>
                <span>{camera.signalStrength}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span
                  className={camera.isConnected ? 'text-green-600 font-semibold' : 'text-gray-400'}
                >
                  {camera.isConnected ? '● Connected' : '○ Disconnected'}
                </span>
              </div>
            </div>

            {camera.isConnected ? (
              <button
                onClick={() => disconnect(camera.ipAddress)}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => connect(camera.ipAddress)}
                disabled={connecting === camera.ipAddress}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover: bg-blue-700, disabled:opacity-50"
              >
                {connecting === camera.ipAddress ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Ensure cameras are on the same WiFi network as this device</li>
          <li>• Enable WiFi in camera menu (Menu → Communication → WiFi)</li>
          <li>• Discovery works with Canon EOS R series and 5D Mark IV</li>
          <li>• Click refresh if your camera doesn't appear immediately</li>
        </ul>
      </div>
    </div>
  );
}
