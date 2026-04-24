import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import useNotificationStore from '../store/notificationStore';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllRead } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds
    const interval = setInterval(() => {
      useNotificationStore.getState().fetchUnreadCount();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = () => {
    setOpen(!open);
    if (!open) fetchNotifications();
  };

  const typeIcons = {
    order_update: '📦',
    delivery_update: '🚚',
    delivery_assignment: '📋',
    salary_credit: '💰',
    promotion: '🎉',
    loyalty_points: '⭐',
    leave_update: '📅',
    low_stock: '⚠️',
    system: '🔔',
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative text-dark-navy hover:text-primary-green transition-colors p-1"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-card-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-card-border flex items-center justify-between bg-gradient-to-r from-rose-50 to-fuchsia-50">
            <h3 className="font-semibold text-dark-navy text-sm m-0">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-xs text-primary-green hover:text-fuchsia-700 font-medium flex items-center gap-1"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-muted-text">
                <Bell size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm m-0">No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <div
                  key={n._id}
                  onClick={() => {
                    if (!n.isRead) markAsRead(n._id);
                    if (n.link) {
                      navigate(n.link);
                      setOpen(false);
                    } else {
                      navigate('/profile');
                      setOpen(false);
                    }
                  }}
                  className={`px-4 py-3 border-b border-card-border last:border-b-0 cursor-pointer transition-colors hover:bg-rose-50 ${
                    !n.isRead ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">{typeIcons[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm m-0 leading-snug ${!n.isRead ? 'font-semibold text-dark-navy' : 'text-muted-text'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-text m-0 mt-0.5 truncate">{n.message}</p>
                      <p className="text-[10px] text-gray-400 m-0 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-card-border text-center bg-gray-50">
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-primary-green hover:text-fuchsia-700 font-medium"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
