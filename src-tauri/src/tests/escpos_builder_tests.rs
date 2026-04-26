use crate::escpos_builder::EscPosBuilder;

// --- Initialization Tests ---

#[test]
fn test_new_initializes_with_esc_at_command() {
    let builder = EscPosBuilder::new();
    // ESC @ (Initialize printer) = [0x1B, 0x40]
    assert_eq!(&builder.bytes[0..2], &[0x1B, 0x40]);
}

#[test]
fn test_default_is_same_as_new() {
    let from_new = EscPosBuilder::new();
    let from_default = EscPosBuilder::default();
    assert_eq!(from_new.bytes, from_default.bytes);
}

#[test]
fn test_new_starts_with_exactly_two_bytes() {
    let builder = EscPosBuilder::new();
    assert_eq!(builder.bytes.len(), 2);
}

// --- Text Tests ---

#[test]
fn test_text_appends_bytes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.text("ABC");
    assert_eq!(builder.bytes.len(), initial_len + 3);
    assert_eq!(&builder.bytes[initial_len..], b"ABC");
}

#[test]
fn test_text_empty_string_adds_no_bytes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.text("");
    assert_eq!(builder.bytes.len(), initial_len);
}

#[test]
fn test_text_line_appends_text_and_linefeed() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.text_line("Hello");
    // "Hello" = 5 bytes + 1 LF (0x0A)
    assert_eq!(builder.bytes.len(), initial_len + 6);
    assert_eq!(builder.bytes[initial_len + 5], 0x0A);
}

// --- Feed Tests ---

#[test]
fn test_feed_one_line_adds_one_lf() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.feed(1);
    assert_eq!(builder.bytes.len(), initial_len + 1);
    assert_eq!(builder.bytes[initial_len], 0x0A);
}

#[test]
fn test_feed_multiple_lines() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.feed(3);
    assert_eq!(builder.bytes.len(), initial_len + 3);
    for i in 0..3 {
        assert_eq!(builder.bytes[initial_len + i], 0x0A);
    }
}

#[test]
fn test_feed_zero_lines_adds_no_bytes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.feed(0);
    assert_eq!(builder.bytes.len(), initial_len);
}

// --- Align Tests ---

#[test]
fn test_align_left_outputs_correct_bytes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.align(0); // Left
    assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x61, 0x00]);
}

#[test]
fn test_align_center_outputs_correct_bytes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.align(1); // Center
    assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x61, 0x01]);
}

#[test]
fn test_align_right_outputs_correct_bytes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.align(2); // Right
    assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x61, 0x02]);
}

// --- Bold Tests ---

#[test]
fn test_bold_on_outputs_correct_bytes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.bold(true);
    assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x45, 0x01]);
}

#[test]
fn test_bold_off_outputs_correct_bytes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.bold(false);
    assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x45, 0x00]);
}

// --- Size Tests ---

#[test]
fn test_size_default_one_one_is_normal() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.size(1, 1);
    // w=0, h=0 => n = (0 << 4) | 0 = 0x00
    assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x00]);
}

#[test]
fn test_size_two_two_is_double() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.size(2, 2);
    // w=1, h=1 => n = (1 << 4) | 1 = 0x11
    assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x11]);
}

#[test]
fn test_size_clamps_to_max_eight() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    // Values above 8 should be clamped to 8
    builder.size(9, 9);
    // w = clamp(9,1,8)-1 = 7, h = clamp(9,1,8)-1 = 7 => n = (7 << 4) | 7 = 0x77
    assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x77]);
}

#[test]
fn test_size_clamps_to_min_one() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    // Values of 0 should be clamped to 1
    builder.size(0, 0);
    // w = clamp(0,1,8)-1 = 0, h = clamp(0,1,8)-1 = 0 => n = 0x00
    assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x00]);
}

#[test]
fn test_size_max_eight_produces_correct_byte() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.size(8, 8);
    // w=7, h=7 => n = (7 << 4) | 7 = 0x77
    assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x77]);
}

// --- Underline Tests ---

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
fn test_underline_clamps_to_max_two() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.underline(5); // Should be clamped to 2
    assert_eq!(&builder.bytes[initial_len..], &[0x1B, 0x2D, 0x02]);
}

// --- Inverse Tests ---

#[test]
fn test_inverse_on_outputs_correct_bytes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.inverse(true);
    assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x42, 0x01]);
}

#[test]
fn test_inverse_off_outputs_correct_bytes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.inverse(false);
    assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x42, 0x00]);
}

// --- Cut Tests ---

#[test]
fn test_cut_outputs_full_cut_command() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.cut();
    // GS V A 0 (Full Cut)
    assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x56, 0x41, 0x00]);
}

// --- Divider Tests ---

#[test]
fn test_divider_creates_correct_number_of_dashes() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.divider(32);
    // 32 dashes + LF
    assert_eq!(builder.bytes.len(), initial_len + 33);
    for i in 0..32 {
        assert_eq!(builder.bytes[initial_len + i], b'-');
    }
    assert_eq!(builder.bytes[initial_len + 32], 0x0A);
}

#[test]
fn test_divider_48_chars_for_80mm_paper() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.divider(48);
    // 48 dashes + LF
    assert_eq!(builder.bytes.len(), initial_len + 49);
}

#[test]
fn test_divider_zero_width_adds_only_lf() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.divider(0);
    // Empty string + LF (text_line always adds LF)
    assert_eq!(builder.bytes.len(), initial_len + 1);
    assert_eq!(builder.bytes[initial_len], 0x0A);
}

// --- text_left_right Tests ---

#[test]
fn test_text_left_right_pads_correctly() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.text_left_right("Total", "100.00", 32);
    // "Total" = 5 chars, "100.00" = 6 chars, padding = 32 - 5 - 6 = 21 spaces
    // Total output = 5 + 21 + 6 = 32 chars + LF
    assert_eq!(builder.bytes.len(), initial_len + 33);
    // Verify left text
    assert_eq!(&builder.bytes[initial_len..initial_len + 5], b"Total");
    // Verify right text ends correctly
    assert_eq!(&builder.bytes[initial_len + 26..initial_len + 32], b"100.00");
    assert_eq!(builder.bytes[initial_len + 32], 0x0A);
}

#[test]
fn test_text_left_right_uses_fallback_when_too_long() {
    let mut builder = EscPosBuilder::new();
    // Combined length > char_width
    builder.text_left_right("VeryLongItemName", "VeryLongPrice", 10);
    // Should fall back to "VeryLongItemName VeryLongPrice\n"
    let output = String::from_utf8_lossy(&builder.bytes[2..]);
    assert!(output.contains("VeryLongItemName VeryLongPrice"));
}

#[test]
fn test_text_left_right_exact_fit_uses_fallback() {
    let mut builder = EscPosBuilder::new();
    // left_len + right_len = char_width (exact), should use fallback (>= not >)
    builder.text_left_right("Hello", "World", 10); // 5 + 5 = 10 >= 10
    let output = String::from_utf8_lossy(&builder.bytes[2..]);
    // Fallback format: "Hello World\n"
    assert!(output.contains("Hello World"));
}

// --- item_row Tests ---

#[test]
fn test_item_row_formats_correctly_for_58mm() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    // 58mm paper: (14, 4, 6, 8) = 32 total
    builder.item_row("Coffee", "2", "3.50", "7.00", (14, 4, 6, 8));
    // Total = 14+4+6+8 = 32 chars + LF
    assert_eq!(builder.bytes.len(), initial_len + 33);
}

#[test]
fn test_item_row_truncates_long_item_name() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    let long_name = "A Very Long Item Name That Exceeds Column Width";
    // Column widths for 58mm: (14, 4, 6, 8)
    builder.item_row(long_name, "1", "9.99", "9.99", (14, 4, 6, 8));
    // The item name is truncated to 13 chars (14-1 for trailing space), then formatted to full row
    // Total length = 14 + 4 + 6 + 8 = 32 chars + LF
    assert_eq!(builder.bytes.len(), initial_len + 33);
}

#[test]
fn test_item_row_formats_correctly_for_80mm() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    // 80mm paper: (22, 6, 9, 11) = 48 total
    builder.item_row("Espresso", "1", "2.50", "2.50", (22, 6, 9, 11));
    // Total = 22+6+9+11 = 48 chars + LF
    assert_eq!(builder.bytes.len(), initial_len + 49);
}

// --- barcode_1d Tests ---

#[test]
fn test_barcode_1d_starts_with_hri_command() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.barcode_1d("ORDER123");
    // First bytes: GS H 02 (HRI below) = [0x1D, 0x48, 0x02]
    assert_eq!(&builder.bytes[initial_len..initial_len + 3], &[0x1D, 0x48, 0x02]);
}

#[test]
fn test_barcode_1d_sets_height_command() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.barcode_1d("TEST");
    // GS h 64 (height 64) = [0x1D, 0x68, 0x40]
    assert_eq!(&builder.bytes[initial_len + 3..initial_len + 6], &[0x1D, 0x68, 0x40]);
}

#[test]
fn test_barcode_1d_sets_width_command() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.barcode_1d("TEST");
    // GS w 02 (width module 2) = [0x1D, 0x77, 0x02]
    assert_eq!(&builder.bytes[initial_len + 6..initial_len + 9], &[0x1D, 0x77, 0x02]);
}

#[test]
fn test_barcode_1d_uses_code128_system() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.barcode_1d("TEST");
    // GS k 0x49 (CODE128) command start
    // Offset: 3 (HRI) + 3 (height) + 3 (width) = 9
    assert_eq!(&builder.bytes[initial_len + 9..initial_len + 11], &[0x1D, 0x6B]);
    assert_eq!(builder.bytes[initial_len + 11], 0x49); // CODE128
}

#[test]
fn test_barcode_1d_encodes_data_with_subset_b() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.barcode_1d("A");
    // Barcode data: {B prefix (0x7B, 0x42) + "A" (0x41) = 3 bytes
    let len_byte = builder.bytes[initial_len + 12];
    assert_eq!(len_byte, 3); // "{B" + "A"
    // Subset B prefix: {B = [0x7B, 0x42]
    assert_eq!(&builder.bytes[initial_len + 13..initial_len + 15], &[0x7B, 0x42]);
    // "A" byte
    assert_eq!(builder.bytes[initial_len + 15], 0x41);
}

#[test]
fn test_barcode_1d_ends_with_two_feeds() {
    let mut builder = EscPosBuilder::new();
    builder.barcode_1d("TEST");
    let len = builder.bytes.len();
    // Last two bytes should be 0x0A (LF) x2
    assert_eq!(builder.bytes[len - 2], 0x0A);
    assert_eq!(builder.bytes[len - 1], 0x0A);
}

// --- qr_code Tests ---

#[test]
fn test_qr_code_sets_model_2() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.qr_code("https://example.com");
    // First QR command: GS ( k 0x04 0x00 0x31 0x41 0x32 0x00 = Model 2
    assert_eq!(
        &builder.bytes[initial_len..initial_len + 9],
        &[0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]
    );
}

#[test]
fn test_qr_code_sets_module_size() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.qr_code("https://example.com");
    // Second QR command: GS ( k 0x03 0x00 0x31 0x43 0x06 = size 6
    assert_eq!(
        &builder.bytes[initial_len + 9..initial_len + 16],
        &[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]
    );
}

#[test]
fn test_qr_code_sets_error_correction_level_l() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.qr_code("https://example.com");
    // Third QR command: GS ( k 0x03 0x00 0x31 0x45 0x30 = Level L
    assert_eq!(
        &builder.bytes[initial_len + 16..initial_len + 24],
        &[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30]
    );
}

#[test]
fn test_qr_code_stores_url_data() {
    let url = "https://example.com";
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.qr_code(url);
    // The URL is stored after GS ( k pL pH 0x31 0x50 0x30
    // Offset for data store command: 9 (model) + 8 (size) + 8 (error) = 25, then 8 byte header
    let store_offset = initial_len + 9 + 8 + 8;
    // store header: GS ( k pL pH 0x31 0x50 0x30
    assert_eq!(&builder.bytes[store_offset..store_offset + 3], &[0x1D, 0x28, 0x6B]);
    let url_bytes = url.as_bytes();
    let data_start = store_offset + 8;
    assert_eq!(&builder.bytes[data_start..data_start + url_bytes.len()], url_bytes);
}

#[test]
fn test_qr_code_prints_qr_code() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.qr_code("test");
    // Print command: GS ( k 0x03 0x00 0x31 0x51 0x30
    // Find this pattern in the bytes (should be near the end, before feeds)
    let bytes = &builder.bytes[initial_len..];
    let print_cmd = [0x1D u8, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30];
    let found = bytes.windows(8).any(|w| w == print_cmd);
    assert!(found, "QR print command not found in output");
}

#[test]
fn test_qr_code_ends_with_two_feeds() {
    let mut builder = EscPosBuilder::new();
    builder.qr_code("https://example.com");
    let len = builder.bytes.len();
    assert_eq!(builder.bytes[len - 2], 0x0A);
    assert_eq!(builder.bytes[len - 1], 0x0A);
}

#[test]
fn test_qr_code_pL_pH_calculation() {
    // store_len = url_bytes.len() + 3
    // For a 1-byte URL ("A"): store_len = 1 + 3 = 4 => pL = 4, pH = 0
    let url = "A";
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.qr_code(url);
    // Data store command is at offset: 9+8+8 = 25 from initial_len
    let store_offset = initial_len + 9 + 8 + 8;
    // pL = bytes[store_offset + 3], pH = bytes[store_offset + 4]
    let p_l = builder.bytes[store_offset + 3];
    let p_h = builder.bytes[store_offset + 4];
    let store_len = url.len() + 3;
    assert_eq!(p_l as usize, store_len % 256);
    assert_eq!(p_h as usize, store_len / 256);
}

// --- Sequence / Integration Tests ---

#[test]
fn test_full_receipt_sequence_builds_correct_bytes() {
    let mut builder = EscPosBuilder::new();
    builder.align(1); // Center
    builder.bold(true);
    builder.size(2, 2);
    builder.text_line("STORE NAME");
    builder.bold(false);
    builder.size(1, 1);
    builder.align(0); // Left
    builder.divider(32);
    builder.text_left_right("TOTAL", "99.99", 32);
    builder.cut();

    // Verify it starts with ESC @
    assert_eq!(&builder.bytes[0..2], &[0x1B, 0x40]);
    // Verify align center is present
    assert!(builder.bytes.windows(3).any(|w| w == [0x1B, 0x61, 0x01]));
    // Verify bold on is present
    assert!(builder.bytes.windows(3).any(|w| w == [0x1B, 0x45, 0x01]));
    // Verify cut command is at the end
    let len = builder.bytes.len();
    assert_eq!(&builder.bytes[len - 4..], &[0x1D, 0x56, 0x41, 0x00]);
}

#[test]
fn test_builder_accumulates_operations() {
    let mut builder = EscPosBuilder::new();
    let start_len = builder.bytes.len();
    builder.text("Hello");
    builder.feed(1);
    builder.text(" World");
    // "Hello" = 5, LF = 1, " World" = 6, total = 12
    assert_eq!(builder.bytes.len(), start_len + 12);
}

// --- Boundary Tests ---

#[test]
fn test_size_width_four_height_one() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.size(4, 1);
    // w=3, h=0 => n = (3 << 4) | 0 = 0x30
    assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x30]);
}

#[test]
fn test_size_width_one_height_four() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.size(1, 4);
    // w=0, h=3 => n = (0 << 4) | 3 = 0x03
    assert_eq!(&builder.bytes[initial_len..], &[0x1D, 0x21, 0x03]);
}

#[test]
fn test_item_row_short_name_does_not_truncate() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    // Short name that fits well within the column
    builder.item_row("Tea", "1", "1.50", "1.50", (14, 4, 6, 8));
    // Total = 32 chars + LF
    assert_eq!(builder.bytes.len(), initial_len + 33);
    // "Tea" should appear at the start (left-aligned in 14-char column)
    assert_eq!(&builder.bytes[initial_len..initial_len + 3], b"Tea");
}

#[test]
fn test_text_left_right_single_char_each() {
    let mut builder = EscPosBuilder::new();
    let initial_len = builder.bytes.len();
    builder.text_left_right("A", "B", 10);
    // "A" = 1, "B" = 1, padding = 8 spaces, total = 10 chars + LF
    assert_eq!(builder.bytes.len(), initial_len + 11);
    assert_eq!(builder.bytes[initial_len], b'A');
    assert_eq!(builder.bytes[initial_len + 9], b'B');
}