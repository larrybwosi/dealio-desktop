import { invoke } from "@tauri-apps/api/core";

export interface Shift {
  id: string;
  opened_at: string;
  closed_at?: string;
  operator_id?: string;
  starting_float: number;
  expected_cash: number;
  actual_cash?: number;
  variance?: number;
  total_cash_sales: number;
  total_cash_drops: number;
  total_cash_refunds: number;
}

export const shiftService = {
  getShiftStatus: async (): Promise<Shift | null> => {
    return await invoke("get_shift_command");
  },

  openShift: async (cardId: string, pin: string, floatAmount: number): Promise<Shift> => {
    return await invoke("open_shift_command", {
      cardId,
      pin,
      floatAmount: Number(floatAmount) // Ensure number type
    });
  },

  closeShift: async (cardId: string, pin: string, actualCount: number, printerName?: string): Promise<Shift> => {
    return await invoke("close_shift_command", {
      cardId,
      pin,
      actualCount: Number(actualCount),
      printerName
    });
  },

  addCashDrop: async (amount: number, reason: string): Promise<void> => {
    return await invoke("add_cash_drop_command", {
      amount: Number(amount),
      reason
    });
  }
};