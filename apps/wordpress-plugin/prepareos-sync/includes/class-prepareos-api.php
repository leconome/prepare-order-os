<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * HTTP client for communicating with the PrepareOS API.
 */
class PrepareOS_API {

	/** @var string */
	private $api_url;

	/** @var string */
	private $api_key;

	/**
	 * @param string $api_url  Base URL of the PrepareOS API (e.g. https://api.prepareos.com).
	 * @param string $api_key  API key starting with "sk_".
	 */
	public function __construct( $api_url, $api_key ) {
		$this->api_url = rtrim( $api_url, '/' );
		$this->api_key = $api_key;
	}

	/**
	 * Ping the PrepareOS API to verify the connection.
	 *
	 * @return array|WP_Error  Decoded JSON on success, WP_Error on failure.
	 */
	public function ping() {
		return $this->request( 'GET', '/api/webhook/ping' );
	}

	/**
	 * Register this WordPress site with PrepareOS.
	 *
	 * @param string $site_url  The WordPress site URL.
	 * @param string $site_name The WordPress site name.
	 *
	 * @return array|WP_Error  Decoded JSON on success, WP_Error on failure.
	 */
	public function register( $site_url, $site_name ) {
		return $this->request( 'POST', '/api/webhook/register', array(
			'siteUrl'  => $site_url,
			'siteName' => $site_name,
		) );
	}

	/**
	 * Fetch WooCommerce product categories and push them to PrepareOS.
	 *
	 * @return array|WP_Error  Decoded JSON on success, WP_Error on failure.
	 */
	public function sync_categories() {
		$categories = $this->get_woo_categories();

		if ( is_wp_error( $categories ) ) {
			return $categories;
		}

		if ( empty( $categories ) ) {
			return new WP_Error(
				'prepareos_no_categories',
				'Aucune categorie WooCommerce trouvee.'
			);
		}

		return $this->request( 'POST', '/api/webhook/sync/categories', array(
			'categories' => $categories,
		), 30 );
	}

	/**
	 * Fetch all WooCommerce product categories formatted for PrepareOS sync.
	 *
	 * @return array|WP_Error  Array of category objects or WP_Error.
	 */
	private function get_woo_categories() {
		$terms = get_terms( array(
			'taxonomy'   => 'product_cat',
			'hide_empty' => false,
			'orderby'    => 'parent',
			'order'      => 'ASC',
		) );

		if ( is_wp_error( $terms ) ) {
			return $terms;
		}

		$categories = array();
		foreach ( $terms as $term ) {
			$category = array(
				'id'          => (int) $term->term_id,
				'name'        => $term->name,
				'slug'        => $term->slug,
				'parent'      => (int) $term->parent,
				'description' => $term->description ?? '',
				'image'       => null,
			);

			// WooCommerce stores category image as term meta thumbnail_id
			$thumbnail_id = get_term_meta( $term->term_id, 'thumbnail_id', true );
			if ( $thumbnail_id ) {
				$image_src = wp_get_attachment_image_src( $thumbnail_id, 'full' );
				if ( $image_src ) {
					$category['image'] = array(
						'src' => $image_src[0],
					);
				}
			}

			$categories[] = $category;
		}

		return $categories;
	}

	/**
	 * Send an HTTP request to the PrepareOS API.
	 *
	 * @param string     $method   HTTP method (GET, POST, etc.).
	 * @param string     $endpoint API endpoint path.
	 * @param array|null $body     Optional request body (will be JSON-encoded).
	 * @param int        $timeout  Request timeout in seconds.
	 *
	 * @return array|WP_Error  Decoded JSON on success, WP_Error on failure.
	 */
	private function request( $method, $endpoint, $body = null, $timeout = 15 ) {
		$url = $this->api_url . $endpoint;

		$args = array(
			'method'  => $method,
			'timeout' => $timeout,
			'headers' => array(
				'Authorization' => 'Bearer ' . $this->api_key,
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
			),
		);

		if ( $body !== null ) {
			$args['body'] = wp_json_encode( $body );
		}

		$response = wp_remote_request( $url, $args );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$response_body = wp_remote_retrieve_body( $response );
		$data = json_decode( $response_body, true );

		if ( $status_code < 200 || $status_code >= 300 ) {
			$error_message = isset( $data['error'] ) ? $data['error'] : "HTTP $status_code";
			return new WP_Error( 'prepareos_api_error', $error_message, array( 'status' => $status_code ) );
		}

		if ( $data === null ) {
			return new WP_Error( 'prepareos_api_error', 'Reponse invalide du serveur.' );
		}

		return $data;
	}
}
