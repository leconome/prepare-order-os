<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles the WP Admin settings page for PrepareOS Sync.
 */
class PrepareOS_Admin {

	/** Option keys stored in wp_options. */
	const OPTION_API_KEY = 'prepareos_api_key';
	const OPTION_API_URL = 'prepareos_api_url';

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_menu_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_init', array( $this, 'maybe_register_on_save' ) );
	}

	/**
	 * Add a submenu page under WooCommerce.
	 */
	public function add_menu_page() {
		add_submenu_page(
			'woocommerce',
			'PrepareOS Sync',
			'PrepareOS Sync',
			'manage_woocommerce',
			'prepareos-sync',
			array( $this, 'render_settings_page' )
		);
	}

	/**
	 * Register plugin settings with the WordPress Settings API.
	 */
	public function register_settings() {
		register_setting( 'prepareos_sync_settings', self::OPTION_API_KEY, array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => '',
		) );

		register_setting( 'prepareos_sync_settings', self::OPTION_API_URL, array(
			'type'              => 'string',
			'sanitize_callback' => 'esc_url_raw',
			'default'           => '',
		) );
	}

	/**
	 * After settings are saved (redirect back to settings page with "settings-updated"),
	 * call PrepareOS register endpoint.
	 */
	public function maybe_register_on_save() {
		if ( ! isset( $_GET['settings-updated'] ) || $_GET['settings-updated'] !== 'true' ) {
			return;
		}

		if ( ! isset( $_GET['page'] ) || $_GET['page'] !== 'prepareos-sync' ) {
			return;
		}

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}

		$api_url = get_option( self::OPTION_API_URL, '' );
		$api_key = get_option( self::OPTION_API_KEY, '' );

		if ( empty( $api_url ) || empty( $api_key ) ) {
			return;
		}

		$api    = new PrepareOS_API( $api_url, $api_key );
		$result = $api->register( get_site_url(), get_bloginfo( 'name' ) );

		if ( is_wp_error( $result ) ) {
			set_transient( 'prepareos_connection_error', $result->get_error_message(), 60 );
		} else {
			set_transient( 'prepareos_connection_success', true, 60 );
			delete_transient( 'prepareos_connection_error' );
		}
	}

	/**
	 * Render the settings page (loads the template).
	 */
	public function render_settings_page() {
		$api_key = get_option( self::OPTION_API_KEY, '' );
		$api_url = get_option( self::OPTION_API_URL, '' );
		$connection_success = get_transient( 'prepareos_connection_success' );
		$connection_error   = get_transient( 'prepareos_connection_error' );

		// Clear transients after reading
		delete_transient( 'prepareos_connection_success' );
		delete_transient( 'prepareos_connection_error' );

		include PREPAREOS_SYNC_PLUGIN_DIR . 'admin/views/settings-page.php';
	}
}
