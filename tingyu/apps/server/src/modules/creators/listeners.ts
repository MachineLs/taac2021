// Event listeners for the creators module — owner: B2. Called once by createApp().
import { on } from '../../core/events';
import { accrueCommission, voidCommission } from './service';

export function registerListeners() {
  on('appointment.paid', ({ appointmentId }) => { accrueCommission(appointmentId); });
  on('appointment.refunded', ({ appointmentId }) => { voidCommission(appointmentId); });
}
