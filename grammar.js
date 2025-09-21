/**
 * @file CRBasic parser for Campbell Scientific dataloggers
 * @author philberndt <philberndt@example.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'crbasic',

  extras: $ => [
    /\s/,
    $.comment,
  ],

  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.comment,
      $.program_structure,
      $.variable_declaration,
      $.constant_declaration,
      $.assignment,
      $.function_call,
      $.control_structure,
      $.scan_structure,
      $.menu_structure,
      $.table_structure,
      $.preprocessor_directive,
    ),

    comment: $ => /'[^\r\n]*/,

    // Program structure
    program_structure: $ => choice(
      seq('BeginProg', repeat($._statement), 'EndProg'),
      seq('Function', $.identifier, optional($.parameter_list), repeat($._statement), 'EndFunction'),
      seq('Sub', $.identifier, optional($.parameter_list), repeat($._statement), 'EndSub'),
    ),

    // Variable declarations
    variable_declaration: $ => seq(
      choice('Dim', 'Public'),
      $.identifier,
      optional(seq('As', $.type)),
    ),

    constant_declaration: $ => choice(
      seq('Const', $.identifier, '=', $._expression),
      seq('ConstTable', repeat(seq($.identifier, '=', $._expression)), 'EndConstTable'),
    ),

    // Assignments
    assignment: $ => seq(
      $.identifier,
      choice('=', '*=', '+=', '-=', '/=', '\\=', '^=', '&='),
      $._expression,
    ),

    // Function calls
    function_call: $ => seq(
      $.identifier,
      '(',
      optional($.argument_list),
      ')',
    ),

    argument_list: $ => seq(
      $._expression,
      repeat(seq(',', $._expression)),
    ),

    parameter_list: $ => seq(
      '(',
      optional(seq(
        $.identifier,
        repeat(seq(',', $.identifier))
      )),
      ')',
    ),

    // Control structures
    control_structure: $ => choice(
      $.if_statement,
      $.for_loop,
      $.while_loop,
      $.do_loop,
      $.select_statement,
    ),

    if_statement: $ => seq(
      'If',
      $._expression,
      'Then',
      repeat($._statement),
      repeat(seq(choice('ElseIf', 'Else If'), $._expression, 'Then', repeat($._statement))),
      optional(seq('Else', repeat($._statement))),
      'EndIf',
    ),

    for_loop: $ => prec.right(seq(
      'For',
      field('variable', $.identifier),
      '=',
      field('start', $._expression),
      'To',
      field('end', $._expression),
      optional(seq('Step', field('step', $._expression))),
      repeat($._statement),
      'Next',
      optional(field('variable_end', $.identifier)),
    )),

    while_loop: $ => seq(
      'While',
      $._expression,
      repeat($._statement),
      'Wend',
    ),

    do_loop: $ => prec.right(seq(
      'Do',
      repeat($._statement),
      choice(
        seq('Loop', 'Until', $._expression),
        seq('Loop', 'While', $._expression),
        'Loop',
      ),
    )),

    select_statement: $ => seq(
      'Select',
      'Case',
      $._expression,
      repeat(choice(
        seq('Case', $._expression, repeat($._statement)),
        seq('Case', 'Is', $._expression, repeat($._statement)),
        seq('Case', 'Else', repeat($._statement)),
      )),
      'EndSelect',
    ),

    // Scan and measurement structures
    scan_structure: $ => choice(
      seq('Scan', '(', $._expression, ',', $.identifier, ',', $._expression, ',', $._expression, ')', repeat($._statement), 'NextScan'),
      seq('SubScan', '(', $._expression, ',', $.identifier, ')', repeat($._statement), 'NextSubScan'),
      seq('SlowSequence', repeat($._statement), 'EndSequence'),
    ),

    // Menu structures
    menu_structure: $ => choice(
      seq('DisplayMenu', repeat($.menu_item), 'EndMenu'),
      seq('SubMenu', $.identifier, repeat($.menu_item), 'EndSubMenu'),
    ),

    menu_item: $ => seq('MenuItem', $.string, $.identifier),

    // Table structures
    table_structure: $ => choice(
      seq('DataTable', $.identifier, $.boolean, $._expression, repeat($._statement), 'EndTable'),
      seq('CallTable', $.identifier),
    ),

    // Preprocessor directives
    preprocessor_directive: $ => choice(
      seq('#If', $._expression, repeat($._statement), optional(seq('#Else', repeat($._statement))), '#EndIf'),
      seq('#IfDef', $.identifier, repeat($._statement), optional(seq('#Else', repeat($._statement))), '#EndIf'),
      seq('#UnDef', $.identifier),
      seq('Include', $.string),
    ),

    // Expressions
    _expression: $ => choice(
      $.identifier,
      $.number,
      $.string,
      $.boolean,
      $.binary_expression,
      $.unary_expression,
      $.parenthesized_expression,
      $.function_call,
    ),

    binary_expression: $ => choice(
      prec.left(1, seq($._expression, choice('+', '-'), $._expression)),
      prec.left(2, seq($._expression, choice('*', '/', 'MOD', 'INTDV'), $._expression)),
      prec.left(3, seq($._expression, '^', $._expression)),
      prec.left(4, seq($._expression, choice('=', '<>', '<', '>', '<=', '>='), $._expression)),
      prec.left(5, seq($._expression, choice('AND', 'OR', 'XOR', 'IMP'), $._expression)),
      prec.left(6, seq($._expression, choice('&', '|'), $._expression)),
      prec.left(7, seq($._expression, choice('>>', '<<'), $._expression)),
    ),

    unary_expression: $ => choice(
      prec(8, seq('-', $._expression)),
      prec(8, seq('+', $._expression)),
      prec(8, seq('NOT', $._expression)),
      prec(8, seq('!', $._expression)),
    ),

    parenthesized_expression: $ => seq(
      '(',
      $._expression,
      ')',
    ),

    // Terminals
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    number: $ => choice(
      // Binary numbers
      /&[bB][0-1]+/,
      // Hexadecimal numbers
      /&[hH][0-9a-fA-F]+/,
      // Decimal numbers
      /\d+/,
      /\d+\.\d*/,
      /\.\d+/,
      // Scientific notation
      /\d+[eE][+-]?\d+/,
      /\d+\.\d*[eE][+-]?\d+/,
      /\.\d+[eE][+-]?\d+/,
      // With suffixes
      /\d+[LlUuFf]/,
      /\d+\.\d*[LlUuFf]/,
    ),

    string: $ => seq(
      '"',
      repeat(choice(
        /[^"\\]/,
        /\\./,
      )),
      '"',
    ),

    boolean: $ => choice(
      'True', 'False', 'TRUE', 'FALSE', 'true', 'false'
    ),

    type: $ => choice(
      'Boolean', 'Float', 'Double', 'Long', 'String',
      'FP2', 'IEEE4', 'IEEE8', 'UINT1', 'UINT2', 'UINT4',
      'Bool8', 'NSEC'
    ),
  },
});