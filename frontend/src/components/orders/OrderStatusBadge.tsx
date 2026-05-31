import Badge from '../ui/Badge';
import { STATUS_LABELS, STATUS_COLORS } from '../../utils/format';
import { OrderStatus } from '../../types';

interface Props {
  status: OrderStatus;
}

export default function OrderStatusBadge({ status }: Props) {
  return (
    <Badge className={STATUS_COLORS[status] || 'bg-gray-800 text-gray-200'}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}
