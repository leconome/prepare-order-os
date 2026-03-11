<?php
/**
 * Plugin Name: PrepareOS Sync
 * Plugin URI:  https://prepareos.com
 * Description: Connecte votre boutique WooCommerce a PrepareOS pour synchroniser commandes et produits.
 * Version:     1.0.0
 * Author:      PrepareOS
 * Author URI:  https://prepareos.com
 * License:     GPL-2.0+
 * Text Domain: prepareos-sync
 * Requires Plugins: woocommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PREPAREOS_SYNC_VERSION', '1.0.0' );
define( 'PREPAREOS_SYNC_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'PREPAREOS_SYNC_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'PREPAREOS_SYNC_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

/**
 * Check that WooCommerce is active before loading the plugin.
 */
function prepareos_sync_check_woocommerce() {
	if ( ! class_exists( 'WooCommerce' ) ) {
		add_action( 'admin_notices', 'prepareos_sync_woocommerce_missing_notice' );
		return false;
	}
	return true;
}

function prepareos_sync_woocommerce_missing_notice() {
	?>
	<div class="notice notice-error">
		<p>
			<strong>PrepareOS Sync</strong> necessite que
			<a href="https://woocommerce.com/" target="_blank">WooCommerce</a>
			soit installe et active.
		</p>
	</div>
	<?php
}

/**
 * Bootstrap the plugin once all plugins are loaded.
 */
function prepareos_sync_init() {
	if ( ! prepareos_sync_check_woocommerce() ) {
		return;
	}

	require_once PREPAREOS_SYNC_PLUGIN_DIR . 'includes/class-prepareos-api.php';
	require_once PREPAREOS_SYNC_PLUGIN_DIR . 'admin/class-prepareos-admin.php';
	require_once PREPAREOS_SYNC_PLUGIN_DIR . 'includes/class-prepareos-rest.php';

	new PrepareOS_REST();

	if ( is_admin() ) {
		new PrepareOS_Admin();
	}
}
add_action( 'plugins_loaded', 'prepareos_sync_init' );

/**
 * Add a "Settings" link on the plugins list page.
 */
function prepareos_sync_plugin_action_links( $links ) {
	$settings_link = sprintf(
		'<a href="%s">%s</a>',
		admin_url( 'admin.php?page=prepareos-sync' ),
		__( 'Reglages', 'prepareos-sync' )
	);
	array_unshift( $links, $settings_link );
	return $links;
}
add_filter( 'plugin_action_links_' . PREPAREOS_SYNC_PLUGIN_BASENAME, 'prepareos_sync_plugin_action_links' );
