import ManagerLeaves from '../storeOwner/ManagerLeaves';
import adminNavItems from './adminNavItems';

const AdminLeaves = () => {
  return <ManagerLeaves navItems={adminNavItems} title="Admin Panel" />;
};

export default AdminLeaves;
