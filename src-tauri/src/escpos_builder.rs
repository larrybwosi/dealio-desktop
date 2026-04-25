use image::{imageops::FilterType};

pub struct EscPosBuilder {
    pub bytes: Vec<u8>,
}

impl Default for EscPosBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl EscPosBuilder {
    pub fn new() -> Self {
        Self {
            bytes: vec![0x1B, 0x40], // ESC @ (Initialize printer)
        }
    }

    pub fn text(&mut self, text: &str) {
        self.bytes.extend_from_slice(text.as_bytes());
    }

    /// Helper to print text and automatically feed to the next line.
    pub fn text_line(&mut self, text: &str) {
        self.text(text);
        self.feed(1);
    }

    pub fn feed(&mut self, lines: u8) {
        for _ in 0..lines {
            self.bytes.push(0x0A); // LF
        }
    }

    pub fn align(&mut self, pos: u8) {
        // 0 = Left, 1 = Center, 2 = Right
        self.bytes.extend_from_slice(&[0x1B, 0x61, pos]); 
    }

    pub fn bold(&mut self, on: bool) {
        let val = if on { 1 } else { 0 };
        self.bytes.extend_from_slice(&[0x1B, 0x45, val]);
    }

    /// Set text size. Width and height are multipliers from 1 to 8.
    /// Default size is (1, 1). To reset, call `size(1, 1)`.
    pub fn size(&mut self, width_multiplier: u8, height_multiplier: u8) {
        // Clamp values between 1 and 8 to prevent invalid commands
        let w = width_multiplier.clamp(1, 8) - 1;
        let h = height_multiplier.clamp(1, 8) - 1;
        
        // ESC/POS packs both sizes into a single byte using bitwise shifts:
        // n = (width - 1) * 16 + (height - 1)
        let n = (w << 4) | h;
        
        // GS ! n (Select character size)
        self.bytes.extend_from_slice(&[0x1D, 0x21, n]);
    }

    /// Turn underline on or off. 
    /// 0 = Off, 1 = 1-dot thick, 2 = 2-dots thick.
    pub fn underline(&mut self, thickness: u8) {
        let n = thickness.clamp(0, 2);
        
        // ESC - n (Turn underline mode on/off)
        self.bytes.extend_from_slice(&[0x1B, 0x2D, n]);
    }

    /// Turn inverse printing (white text on black background) on or off.
    pub fn inverse(&mut self, on: bool) {
        let n = if on { 1 } else { 0 };
        
        // GS B n (Turn white/black reverse printing mode on/off)
        self.bytes.extend_from_slice(&[0x1D, 0x42, n]);
    }

    pub fn cut(&mut self) {
        self.bytes.extend_from_slice(&[0x1D, 0x56, 0x41, 0x00]); // GS V A 0 (Full Cut)
    }

    // --- NEW: LAYOUT & FORMATTING HELPERS ---

    /// Prints a divider line of dashes to match the PDF divider style.
    /// Provide your paper width in characters (e.g., 32 for 58mm, 48 for 80mm).
    pub fn divider(&mut self, char_width: usize) {
        let dashes = "-".repeat(char_width);
        self.text_line(&dashes);
    }

    /// Aligns left string to the left margin, right string to the right margin.
    /// Perfect for Totals, Subtotals, and Discounts.
    pub fn text_left_right(&mut self, left: &str, right: &str, char_width: usize) {
        let left_len = left.chars().count();
        let right_len = right.chars().count();
        
        if left_len + right_len >= char_width {
            // Fallback if strings are too long
            self.text_line(&format!("{} {}", left, right));
        } else {
            let padding = char_width - left_len - right_len;
            let padded_string = format!("{}{}{}", left, " ".repeat(padding), right);
            self.text_line(&padded_string);
        }
    }

    /// Formats the primary receipt item row.
    /// You must pass the column widths based on your paper size.
    /// Example for 58mm (32 chars): col_widths = (14, 4, 6, 8)
    /// Example for 80mm (48 chars): col_widths = (22, 6, 9, 11)
    pub fn item_row(&mut self, item: &str, qty: &str, price: &str, total: &str, col_widths: (usize, usize, usize, usize)) {
        let (w_item, w_qty, w_price, w_total) = col_widths;
        
        // Safely truncate the item name if it's too long for its column
        let mut item_str = item.to_string();
        if item_str.chars().count() > w_item {
            // Keep room for a trailing space
            let end = item_str.char_indices().nth(w_item - 1).map(|(i, _)| i).unwrap_or(item_str.len());
            item_str = item_str[..end].to_string();
        }

        // Left align Item, Right align Qty, Price, and Total
        let formatted_row = format!(
            "{:<w_item$}{:>w_qty$}{:>w_price$}{:>w_total$}",
            item_str, qty, price, total,
            w_item = w_item, w_qty = w_qty, w_price = w_price, w_total = w_total
        );
        
        self.text_line(&formatted_row);
    }

    // --- NEW: NATIVE 1D BARCODE (CODE128) ---
    /// Prints a standard 1D Barcode with text below it. Perfect for order numbers.
    pub fn barcode_1d(&mut self, data: &str) {
        // HRI characters print position: 2 = Below the barcode
        self.bytes.extend_from_slice(&[0x1D, 0x48, 0x02]);
        
        // Set barcode height (e.g., 64 dots)
        self.bytes.extend_from_slice(&[0x1D, 0x68, 0x40]);
        
        // Set barcode width module (2 to 6, 2 is standard for receipts)
        self.bytes.extend_from_slice(&[0x1D, 0x77, 0x02]);
        
        // Print barcode using CODE128 (System 73 / 0x49)
        // ESC/POS CODE128 requires a subset character prepended to the data. 
        // We use Subset B '{B' (0x7B, 0x42) for standard alphanumerics.
        let mut barcode_data = vec![0x7B, 0x42]; 
        barcode_data.extend_from_slice(data.as_bytes());
        
        let len = barcode_data.len() as u8;
        
        // GS k <m> <n> <data>
        self.bytes.extend_from_slice(&[0x1D, 0x6B, 0x49, len]);
        self.bytes.extend_from_slice(&barcode_data);
        
        self.feed(2); // Padding below the barcode
    }

    // --- NATIVE QR CODE ---
    pub fn qr_code(&mut self, url: &str) {
        let url_bytes = url.as_bytes();
        let store_len = url_bytes.len() + 3; // +3 for the command header bytes
        
        let p_l = (store_len % 256) as u8;
        let p_h = (store_len / 256) as u8;

        // 1. Set QR Code Model (Model 2 is standard)
        // GS ( k 0x04 0x00 0x31 0x41 0x32 0x00
        self.bytes.extend_from_slice(&[0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);

        // 2. Set QR Code Module Size (1 to 16, 6 or 8 is usually best for readability)
        // GS ( k 0x03 0x00 0x31 0x43 <size>
        self.bytes.extend_from_slice(&[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]);

        // 3. Set Error Correction Level (48=L, 49=M, 50=Q, 51=H)
        // GS ( k 0x03 0x00 0x31 0x45 <level>
        self.bytes.extend_from_slice(&[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30]); // 0x30 = 48 (L)

        // 4. Store QR Code Data
        // GS ( k pL pH 0x31 0x50 0x30 <data>
        self.bytes.extend_from_slice(&[0x1D, 0x28, 0x6B, p_l, p_h, 0x31, 0x50, 0x30]);
        self.bytes.extend_from_slice(url_bytes);

        // 5. Print the QR Code
        // GS ( k 0x03 0x00 0x31 0x51 0x30
        self.bytes.extend_from_slice(&[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]);
        
        self.feed(2); // Add some padding below it
    }

    // --- NATIVE LOGO PRINTING (GS v 0) ---
    pub fn logo(&mut self, img_path: &str, is_58mm: bool) -> Result<(), String> {
        let img = image::open(img_path).map_err(|e| e.to_string())?;
        
        // Max width: 58mm = 384px, 80mm = 512px
        let max_width = if is_58mm { 384 } else { 512 };
        
        // Resize while maintaining aspect ratio
        let resized = img.resize(max_width, max_width * 2, FilterType::Nearest);
        let grayscale = resized.to_luma8();
        let (width, height) = grayscale.dimensions();
        
        // Width in bytes (1 bit per pixel)
        let width_bytes = width.div_ceil(8) as u16;
        let x_l = (width_bytes % 256) as u8;
        let x_h = (width_bytes / 256) as u8;
        let y_l = (height % 256) as u8;
        let y_h = ((height / 256) % 256) as u8;

        self.align(1); // Center logo
        
        // GS v 0 (Raster bit image command: normal mode)
        self.bytes.extend_from_slice(&[0x1D, 0x76, 0x30, 0x00, x_l, x_h, y_l, y_h]);

        // Pack 8 pixels into 1 byte
        for y in 0..height {
            for x_byte in 0..width_bytes {
                let mut byte = 0u8;
                for bit in 0..8 {
                    let x = (x_byte * 8) + bit as u16;
                    if (x as u32) < width {
                        // Get the pixel's grayscale value
                        let pixel = grayscale.get_pixel(x as u32, y)[0];
                        
                        // Threshold: If darker than 128, burn a dot (bit = 1)
                        if pixel < 128 {
                            // Shift a 1 into the correct bit position (MSB to LSB)
                            byte |= 1 << (7 - bit);
                        }
                    }
                }
                self.bytes.push(byte);
            }
        }
        
        self.feed(1); // Give it some breathing room after the image
        self.align(0); // Reset to left
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Initialization ---

    #[test]
    fn test_new_initializes_with_esc_at() {
        let builder = EscPosBuilder::new();
        // ESC @ = [0x1B, 0x40]
        assert_eq!(builder.bytes, vec![0x1B, 0x40]);
    }

    #[test]
    fn test_default_is_same_as_new() {
        let builder_default = EscPosBuilder::default();
        let builder_new = EscPosBuilder::new();
        assert_eq!(builder_default.bytes, builder_new.bytes);
    }

    // --- text() ---

    #[test]
    fn test_text_appends_bytes() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.text("AB");
        assert_eq!(builder.bytes[initial_len..], [b'A', b'B']);
    }

    #[test]
    fn test_text_empty_string_does_not_change_bytes() {
        let mut builder = EscPosBuilder::new();
        let initial = builder.bytes.clone();
        builder.text("");
        assert_eq!(builder.bytes, initial);
    }

    #[test]
    fn test_text_ascii_chars() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.text("Hello");
        assert_eq!(&builder.bytes[initial_len..], b"Hello");
    }

    // --- feed() ---

    #[test]
    fn test_feed_zero_lines_does_nothing() {
        let mut builder = EscPosBuilder::new();
        let initial = builder.bytes.clone();
        builder.feed(0);
        assert_eq!(builder.bytes, initial);
    }

    #[test]
    fn test_feed_one_line_appends_lf() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.feed(1);
        assert_eq!(builder.bytes[initial_len..], [0x0A]);
    }

    #[test]
    fn test_feed_multiple_lines() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.feed(3);
        assert_eq!(&builder.bytes[initial_len..], &[0x0A, 0x0A, 0x0A]);
    }

    // --- text_line() ---

    #[test]
    fn test_text_line_appends_text_then_lf() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.text_line("Hi");
        let appended = &builder.bytes[initial_len..];
        assert_eq!(appended, &[b'H', b'i', 0x0A]);
    }

    #[test]
    fn test_text_line_empty_string_only_adds_lf() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.text_line("");
        assert_eq!(&builder.bytes[initial_len..], &[0x0A]);
    }

    // --- align() ---

    #[test]
    fn test_align_left() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.align(0);
        assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x61, 0x00]);
    }

    #[test]
    fn test_align_center() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.align(1);
        assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x61, 0x01]);
    }

    #[test]
    fn test_align_right() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.align(2);
        assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x61, 0x02]);
    }

    // --- bold() ---

    #[test]
    fn test_bold_on() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.bold(true);
        assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x45, 0x01]);
    }

    #[test]
    fn test_bold_off() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.bold(false);
        assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x45, 0x00]);
    }

    // --- size() ---

    #[test]
    fn test_size_1x1_normal_size() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.size(1, 1);
        // w=0, h=0, n = (0<<4)|0 = 0
        assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x00]);
    }

    #[test]
    fn test_size_2x1() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.size(2, 1);
        // w=1, h=0, n = (1<<4)|0 = 16 = 0x10
        assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x10]);
    }

    #[test]
    fn test_size_1x2() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.size(1, 2);
        // w=0, h=1, n = (0<<4)|1 = 1
        assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x01]);
    }

    #[test]
    fn test_size_2x2() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.size(2, 2);
        // w=1, h=1, n = (1<<4)|1 = 17 = 0x11
        assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x11]);
    }

    #[test]
    fn test_size_clamps_below_minimum() {
        // Values of 0 should be clamped to 1, giving same result as (1,1)
        let mut b1 = EscPosBuilder::new();
        b1.size(0, 0);
        let mut b2 = EscPosBuilder::new();
        b2.size(1, 1);
        assert_eq!(b1.bytes, b2.bytes);
    }

    #[test]
    fn test_size_clamps_above_maximum() {
        // Values above 8 should be clamped to 8
        let mut b1 = EscPosBuilder::new();
        b1.size(9, 9);
        let mut b2 = EscPosBuilder::new();
        b2.size(8, 8);
        assert_eq!(b1.bytes, b2.bytes);
    }

    #[test]
    fn test_size_max_8x8() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.size(8, 8);
        // w=7, h=7, n = (7<<4)|7 = 0x77
        assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x77]);
    }

    // --- underline() ---

    #[test]
    fn test_underline_off() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.underline(0);
        assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x2D, 0x00]);
    }

    #[test]
    fn test_underline_one_dot() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.underline(1);
        assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x2D, 0x01]);
    }

    #[test]
    fn test_underline_two_dots() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.underline(2);
        assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x2D, 0x02]);
    }

    #[test]
    fn test_underline_clamps_above_2() {
        // thickness > 2 should be clamped to 2
        let mut b1 = EscPosBuilder::new();
        b1.underline(5);
        let mut b2 = EscPosBuilder::new();
        b2.underline(2);
        assert_eq!(b1.bytes, b2.bytes);
    }

    // --- inverse() ---

    #[test]
    fn test_inverse_on() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.inverse(true);
        assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x42, 0x01]);
    }

    #[test]
    fn test_inverse_off() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.inverse(false);
        assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x42, 0x00]);
    }

    // --- cut() ---

    #[test]
    fn test_cut_appends_gs_v_a_0() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.cut();
        assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x56, 0x41, 0x00]);
    }

    // --- divider() ---

    #[test]
    fn test_divider_produces_correct_number_of_dashes() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.divider(10);
        // Should produce "----------\n"
        let produced = &builder.bytes[initial_len..];
        let s = std::str::from_utf8(&produced[..produced.len() - 1]).unwrap();
        assert_eq!(s.len(), 10);
        assert!(s.chars().all(|c| c == '-'));
        // Last byte is LF
        assert_eq!(produced[produced.len() - 1], 0x0A);
    }

    #[test]
    fn test_divider_zero_width() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.divider(0);
        // Should produce just "\n"
        assert_eq!(&builder.bytes[initial_len..], &[0x0A]);
    }

    #[test]
    fn test_divider_58mm_width() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.divider(32);
        let produced = &builder.bytes[initial_len..];
        // 32 dashes + LF
        assert_eq!(produced.len(), 33);
    }

    // --- text_left_right() ---

    #[test]
    fn test_text_left_right_normal_padding() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.text_left_right("Left", "Right", 20);
        let produced = &builder.bytes[initial_len..];
        // "Left           Right\n" - check it's followed by LF and total length
        let text_part = &produced[..produced.len() - 1];
        let s = std::str::from_utf8(text_part).unwrap();
        assert!(s.starts_with("Left"));
        assert!(s.ends_with("Right"));
        assert_eq!(s.len(), 20);
        assert_eq!(produced[produced.len() - 1], 0x0A);
    }

    #[test]
    fn test_text_left_right_fallback_when_too_long() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        // "LongLeft" (8) + "LongRight" (9) = 17, char_width=10 => fallback
        builder.text_left_right("LongLeft", "LongRight", 10);
        let produced = &builder.bytes[initial_len..];
        let text_part = &produced[..produced.len() - 1];
        let s = std::str::from_utf8(text_part).unwrap();
        // Fallback: "LongLeft LongRight"
        assert_eq!(s, "LongLeft LongRight");
    }

    #[test]
    fn test_text_left_right_exact_fit_is_fallback() {
        // left_len + right_len >= char_width triggers fallback
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.text_left_right("AB", "CD", 4); // 2+2 >= 4
        let produced = &builder.bytes[initial_len..];
        let text_part = &produced[..produced.len() - 1];
        let s = std::str::from_utf8(text_part).unwrap();
        assert_eq!(s, "AB CD");
    }

    #[test]
    fn test_text_left_right_padding_is_correct() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.text_left_right("A", "B", 10);
        let produced = &builder.bytes[initial_len..];
        let text_part = &produced[..produced.len() - 1];
        let s = std::str::from_utf8(text_part).unwrap();
        // "A        B" - 1 + 8 spaces + 1 = 10
        assert_eq!(s.len(), 10);
        assert!(s.starts_with('A'));
        assert!(s.ends_with('B'));
    }

    // --- item_row() ---

    #[test]
    fn test_item_row_normal_row_formatting() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        // 58mm paper: (14, 4, 6, 8)
        builder.item_row("Widget", "2", "5.00", "10.00", (14, 4, 6, 8));
        let produced = &builder.bytes[initial_len..];
        let text_part = &produced[..produced.len() - 1];
        let s = std::str::from_utf8(text_part).unwrap();
        // Total width = 14 + 4 + 6 + 8 = 32
        assert_eq!(s.len(), 32);
        assert_eq!(produced[produced.len() - 1], 0x0A);
    }

    #[test]
    fn test_item_row_truncates_long_item_name() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        let long_name = "A".repeat(20); // 20 chars, col width = 14
        builder.item_row(&long_name, "1", "1.00", "1.00", (14, 4, 6, 8));
        let produced = &builder.bytes[initial_len..];
        let text_part = &produced[..produced.len() - 1];
        let s = std::str::from_utf8(text_part).unwrap();
        // Total width = 14 + 4 + 6 + 8 = 32
        assert_eq!(s.len(), 32);
        // Item column should be truncated
        let item_col = &s[..14];
        assert!(item_col.len() <= 14);
    }

    #[test]
    fn test_item_row_short_item_name_pads_to_column_width() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.item_row("A", "1", "1.00", "1.00", (14, 4, 6, 8));
        let produced = &builder.bytes[initial_len..];
        let text_part = &produced[..produced.len() - 1];
        let s = std::str::from_utf8(text_part).unwrap();
        assert_eq!(s.len(), 32);
    }

    #[test]
    fn test_item_row_80mm_paper() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.item_row("Big Screen TV", "1", "599.99", "599.99", (22, 6, 9, 11));
        let produced = &builder.bytes[initial_len..];
        let text_part = &produced[..produced.len() - 1];
        let s = std::str::from_utf8(text_part).unwrap();
        // Total width = 22 + 6 + 9 + 11 = 48
        assert_eq!(s.len(), 48);
    }

    // --- barcode_1d() ---

    #[test]
    fn test_barcode_1d_contains_code128_prefix() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.barcode_1d("12345");
        let produced = &builder.bytes[initial_len..];
        // Should contain GS k 0x49 (CODE128 command)
        let has_code128 = produced.windows(3).any(|w| w == [0x1D, 0x6B, 0x49]);
        assert!(has_code128);
    }

    #[test]
    fn test_barcode_1d_contains_hri_position_command() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.barcode_1d("ORDER001");
        let produced = &builder.bytes[initial_len..];
        // HRI below: [0x1D, 0x48, 0x02]
        let has_hri = produced.windows(3).any(|w| w == [0x1D, 0x48, 0x02]);
        assert!(has_hri);
    }

    #[test]
    fn test_barcode_1d_contains_height_command() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.barcode_1d("TEST");
        let produced = &builder.bytes[initial_len..];
        // Height: [0x1D, 0x68, 0x40]
        let has_height = produced.windows(3).any(|w| w == [0x1D, 0x68, 0x40]);
        assert!(has_height);
    }

    #[test]
    fn test_barcode_1d_contains_data_bytes() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.barcode_1d("ABC");
        let produced = &builder.bytes[initial_len..];
        // Data should contain the actual data bytes somewhere
        let has_data = produced.windows(3).any(|w| w == [b'A', b'B', b'C']);
        assert!(has_data);
    }

    #[test]
    fn test_barcode_1d_ends_with_feed() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.barcode_1d("XYZ");
        let produced = &builder.bytes[initial_len..];
        // Should end with 2 LF bytes (feed(2))
        let len = produced.len();
        assert!(len >= 2);
        assert_eq!(produced[len - 2], 0x0A);
        assert_eq!(produced[len - 1], 0x0A);
    }

    // --- qr_code() ---

    #[test]
    fn test_qr_code_contains_model_2_command() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.qr_code("https://example.com");
        let produced = &builder.bytes[initial_len..];
        // Model 2: [0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]
        let has_model = produced.windows(9).any(|w| w == [0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
        assert!(has_model);
    }

    #[test]
    fn test_qr_code_contains_module_size_command() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.qr_code("test");
        let produced = &builder.bytes[initial_len..];
        // Module size: [0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]
        let has_size = produced.windows(8).any(|w| w == [0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]);
        assert!(has_size);
    }

    #[test]
    fn test_qr_code_contains_print_command() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.qr_code("test");
        let produced = &builder.bytes[initial_len..];
        // Print: [0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]
        let has_print = produced.windows(8).any(|w| w == [0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]);
        assert!(has_print);
    }

    #[test]
    fn test_qr_code_ends_with_feed() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.qr_code("http://test.com");
        let produced = &builder.bytes[initial_len..];
        let len = produced.len();
        assert!(len >= 2);
        assert_eq!(produced[len - 2], 0x0A);
        assert_eq!(produced[len - 1], 0x0A);
    }

    #[test]
    fn test_qr_code_encodes_url_data() {
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        let url = "AB";
        builder.qr_code(url);
        let produced = &builder.bytes[initial_len..];
        // "AB" as bytes should appear in the output
        let has_data = produced.windows(2).any(|w| w == [b'A', b'B']);
        assert!(has_data);
    }

    #[test]
    fn test_qr_code_pL_pH_encoding() {
        // store_len = url_bytes.len() + 3
        // For url = "A" (1 byte): store_len = 4, pL = 4, pH = 0
        let mut builder = EscPosBuilder::new();
        let initial_len = builder.bytes.len();
        builder.qr_code("A");
        let produced = &builder.bytes[initial_len..];
        // Store data command: [0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...]
        // store_len = 1 + 3 = 4, pL=4, pH=0
        let has_store = produced.windows(8).any(|w| {
            w[0] == 0x1D && w[1] == 0x28 && w[2] == 0x6B && w[5] == 0x31 && w[6] == 0x50 && w[7] == 0x30
        });
        assert!(has_store);
    }

    // --- logo() error case ---

    #[test]
    fn test_logo_returns_error_for_nonexistent_file() {
        let mut builder = EscPosBuilder::new();
        let result = builder.logo("/nonexistent/path/to/image.png", true);
        assert!(result.is_err());
    }

    // --- Integration / sequential usage ---

    #[test]
    fn test_sequential_commands_produce_valid_stream() {
        let mut builder = EscPosBuilder::new();
        // Starts with ESC @
        assert_eq!(&builder.bytes[..2], &[0x1B, 0x40]);
        builder.align(1);
        builder.bold(true);
        builder.text_line("RECEIPT");
        builder.bold(false);
        builder.align(0);
        builder.divider(32);
        builder.cut();
        // All operations should build a non-empty valid byte stream
        assert!(builder.bytes.len() > 10);
        // Should end with cut command
        let last_four = &builder.bytes[builder.bytes.len() - 4..];
        assert_eq!(last_four, &[0x1D, 0x56, 0x41, 0x00]);
    }

    #[test]
    fn test_bytes_grow_with_each_command() {
        let mut builder = EscPosBuilder::new();
        let len_after_init = builder.bytes.len();
        builder.text("X");
        assert!(builder.bytes.len() > len_after_init);
        let len_after_text = builder.bytes.len();
        builder.feed(1);
        assert!(builder.bytes.len() > len_after_text);
    }
}